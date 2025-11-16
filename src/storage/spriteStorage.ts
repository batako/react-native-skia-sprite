import * as FileSystem from 'expo-file-system/legacy';
import type { SpriteAnimations, SpriteAnimationsMeta, SpriteFrame } from '../SpriteAnimator';

/**
 * Metadata describing stored sprite assets.
 */
export interface SpriteMetadata {
  /** Human-friendly name for the sprite. */
  displayName: string;
  /** Creation timestamp in milliseconds. */
  createdAt: number;
  /** Last update timestamp in milliseconds. */
  updatedAt: number;
  [key: string]: unknown;
}

/**
 * Summary returned when listing sprites from storage.
 */
export interface SpriteSummary {
  /** Unique sprite identifier. */
  id: string;
  /** Display name stored in the registry. */
  displayName: string;
  /** Creation timestamp in milliseconds. */
  createdAt: number;
  /** Last update timestamp in milliseconds. */
  updatedAt: number;
}

/**
 * Shape of the payload accepted when saving a sprite.
 */
export type SpriteSavePayload<TExtra = Record<string, unknown>> = {
  /** Optional identifier used when updating an existing sprite. */
  id?: string;
  /** Frame definitions to persist. */
  frames: SpriteFrame[];
  /** Optional animation sequences to persist. */
  animations?: SpriteAnimations;
  /** Optional animation metadata overrides. */
  animationsMeta?: SpriteAnimationsMeta;
  /** Metadata stored alongside the sprite. */
  meta?: Partial<SpriteMetadata>;
} & TExtra;

/**
 * Fully persisted sprite entry loaded from disk.
 */
export type StoredSprite<TExtra = Record<string, unknown>> = Omit<
  SpriteSavePayload<TExtra>,
  'id'
> & {
  id: string;
  meta: SpriteMetadata;
};

/**
 * Parameters accepted by the saveSprite helper.
 */
export interface SaveSpriteParams<TExtra = Record<string, unknown>> {
  /** Sprite data describing the sprite sheet and metadata. */
  sprite: SpriteSavePayload<TExtra>;
}

const REGISTRY_VERSION = 1;

interface SpriteRegistry {
  version: number;
  items: SpriteSummary[];
}

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

let rootDirectoryOverride: string | null = null;
let ensurePromise: Promise<void> | null = null;

/**
 * Configuration options controlling sprite storage locations.
 */
export interface SpriteStorageConfig {
  /** Optional override for the directory used to store assets. */
  rootDir?: string;
}

/**
 * Overrides the root directory used by spriteStorage helpers.
 */
export const configureSpriteStorage = (config: SpriteStorageConfig = {}) => {
  rootDirectoryOverride = config.rootDir ? ensureTrailingSlash(config.rootDir) : null;
  ensurePromise = null;
};

const resolveBaseDir = () => {
  if (rootDirectoryOverride) {
    return rootDirectoryOverride;
  }
  const writable = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? null;
  if (!writable) {
    throw new Error('expo-file-system did not provide a writable directory for sprite storage.');
  }
  return `${ensureTrailingSlash(writable)}sprites/`;
};

const metaDir = () => `${resolveBaseDir()}meta/`;
const registryPath = () => `${resolveBaseDir()}registry.json`;

const ensureDir = async (path: string) => {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
};

/**
 * Ensures the storage directories exist on disk.
 */
const ensureStorage = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureDir(resolveBaseDir());
      await ensureDir(metaDir());
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

const deleteIfExists = async (path: string | null | undefined) => {
  if (!path) return;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
};

/**
 * Reads the sprite registry file from disk.
 */
const readRegistry = async (): Promise<SpriteRegistry> => {
  await ensureStorage();
  const path = registryPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    return { version: REGISTRY_VERSION, items: [] };
  }
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as SpriteRegistry;
    return {
      version: parsed.version ?? REGISTRY_VERSION,
      items: parsed.items ?? [],
    };
  } catch {
    return { version: REGISTRY_VERSION, items: [] };
  }
};

const writeRegistry = async (registry: SpriteRegistry) => {
  await FileSystem.writeAsStringAsync(registryPath(), JSON.stringify(registry, null, 2));
};

/**
 * Adds or updates a sprite entry inside the registry.
 */
const upsertRegistry = async (summary: SpriteSummary) => {
  const registry = await readRegistry();
  const index = registry.items.findIndex((item) => item.id === summary.id);
  if (index >= 0) {
    registry.items[index] = summary;
  } else {
    registry.items.push(summary);
  }
  await writeRegistry(registry);
};

/**
 * Removes a sprite summary from the registry.
 */
const removeFromRegistry = async (id: string) => {
  const registry = await readRegistry();
  const nextItems = registry.items.filter((item) => item.id !== id);
  if (nextItems.length === registry.items.length) {
    return;
  }
  registry.items = nextItems;
  await writeRegistry(registry);
};

/**
 * Generates a unique identifier for a new sprite entry.
 */
const createSpriteId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `sprite_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Persists sprite metadata and animation data to disk.
 */
export const saveSprite = async <TExtra extends Record<string, unknown>>({
  sprite,
}: SaveSpriteParams<TExtra>): Promise<StoredSprite<TExtra>> => {
  if (!sprite?.frames?.length) {
    throw new Error('sprite.frames must contain at least one frame.');
  }

  await ensureStorage();
  const spriteId = sprite.id ?? createSpriteId();
  const metaInput = (sprite.meta ?? {}) as Partial<SpriteMetadata>;
  const now = Date.now();
  const metadata: SpriteMetadata = {
    displayName:
      typeof metaInput.displayName === 'string'
        ? metaInput.displayName
        : `Sprite ${spriteId.slice(0, 6)}`,
    createdAt: typeof metaInput.createdAt === 'number' ? metaInput.createdAt : now,
    updatedAt: typeof metaInput.updatedAt === 'number' ? metaInput.updatedAt : now,
  };

  Object.entries(metaInput).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (key === 'displayName' || key === 'createdAt' || key === 'updatedAt') {
      return;
    }
    (metadata as Record<string, unknown>)[key] = value;
  });

  const storedSprite: StoredSprite<TExtra> = {
    ...sprite,
    id: spriteId,
    meta: metadata,
  };

  await FileSystem.writeAsStringAsync(
    `${metaDir()}${spriteId}.json`,
    JSON.stringify(storedSprite, null, 2),
  );

  await upsertRegistry({
    id: spriteId,
    displayName: metadata.displayName,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  });

  return storedSprite;
};

/**
 * Loads a stored sprite entry by identifier.
 */
export const loadSprite = async <TExtra extends Record<string, unknown>>(
  id: string,
): Promise<StoredSprite<TExtra> | null> => {
  await ensureStorage();
  const path = `${metaDir()}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    return null;
  }
  const raw = await FileSystem.readAsStringAsync(path);
  return JSON.parse(raw) as StoredSprite<TExtra>;
};

/**
 * Lists the sprite summaries persisted on disk.
 */
export const listSprites = async (): Promise<SpriteSummary[]> => {
  const registry = await readRegistry();
  return registry.items.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    createdAt: item.createdAt ?? item.updatedAt ?? Date.now(),
    updatedAt: item.updatedAt ?? item.createdAt ?? Date.now(),
  }));
};

/**
 * Removes a sprite entry including its stored files.
 */
export const deleteSprite = async (id: string) => {
  const sprite = await loadSprite(id);
  if (!sprite) {
    return;
  }
  await deleteIfExists(`${metaDir()}${id}.json`);
  await removeFromRegistry(id);
};

/**
 * Deletes the entire sprite storage directory.
 */
export const clearSpriteStorage = async () => {
  const base = resolveBaseDir();
  await deleteIfExists(base);
  ensurePromise = null;
};

/**
 * Exposes the directory layout used by spriteStorage.
 */
export const getSpriteStoragePaths = () => ({
  root: resolveBaseDir(),
  meta: metaDir(),
  registry: registryPath(),
});
