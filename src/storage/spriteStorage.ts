import * as FileSystem from "expo-file-system/legacy";
import type {
  SpriteAnimations,
  SpriteAnimationsMeta,
  SpriteFrame,
} from "../SpriteAnimator";

export interface SpriteMetadata {
  displayName: string;
  imageUri: string;
  createdAt: number;
  version: number;
  [key: string]: unknown;
}

export interface SpriteSummary {
  id: string;
  displayName: string;
  imageUri: string;
  createdAt: number;
}

export type SpriteSavePayload<TExtra = Record<string, unknown>> = {
  id?: string;
  frames: SpriteFrame[];
  animations?: SpriteAnimations;
  animationsMeta?: SpriteAnimationsMeta;
  meta?: Partial<SpriteMetadata>;
} & TExtra;

export type StoredSprite<TExtra = Record<string, unknown>> = Omit<
  SpriteSavePayload<TExtra>,
  "meta" | "id"
> & {
  id: string;
  meta: SpriteMetadata;
};

export interface SaveSpriteParams<TExtra = Record<string, unknown>> {
  imageTempUri: string;
  sprite: SpriteSavePayload<TExtra>;
}

const REGISTRY_VERSION = 1;

interface SpriteRegistry {
  version: number;
  items: SpriteSummary[];
}

const ensureTrailingSlash = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

let rootDirectoryOverride: string | null = null;
let ensurePromise: Promise<void> | null = null;

export interface SpriteStorageConfig {
  rootDir?: string;
}

export const configureSpriteStorage = (config: SpriteStorageConfig = {}) => {
  rootDirectoryOverride = config.rootDir ? ensureTrailingSlash(config.rootDir) : null;
  ensurePromise = null;
};

const resolveBaseDir = () => {
  if (rootDirectoryOverride) {
    return rootDirectoryOverride;
  }
  const writable =
    FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? null;
  if (!writable) {
    throw new Error(
      "expo-file-system did not provide a writable directory for sprite storage."
    );
  }
  return `${ensureTrailingSlash(writable)}sprites/`;
};

const imagesDir = () => `${resolveBaseDir()}images/`;
const metaDir = () => `${resolveBaseDir()}meta/`;
const registryPath = () => `${resolveBaseDir()}registry.json`;

const ensureDir = async (path: string) => {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
};

const ensureStorage = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureDir(resolveBaseDir());
      await ensureDir(imagesDir());
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
  await FileSystem.writeAsStringAsync(
    registryPath(),
    JSON.stringify(registry, null, 2)
  );
};

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

const removeFromRegistry = async (id: string) => {
  const registry = await readRegistry();
  const nextItems = registry.items.filter((item) => item.id !== id);
  if (nextItems.length === registry.items.length) {
    return;
  }
  registry.items = nextItems;
  await writeRegistry(registry);
};

const extractExtension = (uri: string) => {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  return match ? match[1] : "png";
};

const createSpriteId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `sprite_${Math.random().toString(36).slice(2, 10)}`;
};

export const saveSprite = async <TExtra extends Record<string, unknown>>({
  imageTempUri,
  sprite,
}: SaveSpriteParams<TExtra>): Promise<StoredSprite<TExtra>> => {
  if (!imageTempUri) {
    throw new Error("imageTempUri is required to save a sprite.");
  }
  if (!sprite?.frames?.length) {
    throw new Error("sprite.frames must contain at least one frame.");
  }

  await ensureStorage();
  const spriteId = sprite.id ?? createSpriteId();
  const extension = extractExtension(imageTempUri);
  const imageFilename = `img_${spriteId}.${extension}`;
  const destination = `${imagesDir()}${imageFilename}`;

  await deleteIfExists(destination);
  await FileSystem.copyAsync({
    from: imageTempUri,
    to: destination,
  });

  const metaInput = (sprite.meta ?? {}) as Partial<SpriteMetadata>;
  const metadata: SpriteMetadata = {
    displayName:
      typeof metaInput.displayName === "string"
        ? metaInput.displayName
        : `Sprite ${spriteId.slice(0, 6)}`,
    createdAt:
      typeof metaInput.createdAt === "number" ? metaInput.createdAt : Date.now(),
    version: typeof metaInput.version === "number" ? metaInput.version : 1,
    imageUri: destination,
  };

  Object.entries(metaInput).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (
      key === "displayName" ||
      key === "createdAt" ||
      key === "version" ||
      key === "imageUri"
    ) {
      return;
    }
    (metadata as Record<string, unknown>)[key] = value;
  });
  metadata.imageUri = destination;

  const storedSprite = {
    ...sprite,
    id: spriteId,
    meta: metadata,
  } as StoredSprite<TExtra>;

  await FileSystem.writeAsStringAsync(
    `${metaDir()}${spriteId}.json`,
    JSON.stringify(storedSprite, null, 2)
  );

  await upsertRegistry({
    id: spriteId,
    displayName: metadata.displayName,
    imageUri: metadata.imageUri,
    createdAt: metadata.createdAt,
  });

  return storedSprite;
};

export const loadSprite = async <TExtra extends Record<string, unknown>>(
  id: string
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

export const listSprites = async (): Promise<SpriteSummary[]> => {
  const registry = await readRegistry();
  return registry.items;
};

export const deleteSprite = async (id: string) => {
  const sprite = await loadSprite(id);
  if (!sprite) {
    return;
  }
  await deleteIfExists(sprite.meta?.imageUri);
  await deleteIfExists(`${metaDir()}${id}.json`);
  await removeFromRegistry(id);
};

export const clearSpriteStorage = async () => {
  const base = resolveBaseDir();
  await deleteIfExists(base);
  ensurePromise = null;
};

export const getSpriteStoragePaths = () => ({
  root: resolveBaseDir(),
  images: imagesDir(),
  meta: metaDir(),
  registry: registryPath(),
});
