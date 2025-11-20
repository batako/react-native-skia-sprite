import { useCallback, useEffect, useState } from 'react';
import type { SpriteEditorApi } from './useSpriteEditor';
import type {
  SpriteAnimations,
  SpriteAnimationsMeta,
  SpriteData,
  SpriteFrame,
} from '../../SpriteAnimator';
import {
  deleteSprite as defaultDeleteSprite,
  listSprites as defaultListSprites,
  loadSprite as defaultLoadSprite,
  saveSprite as defaultSaveSprite,
  type SpriteSummary,
  type StoredSprite,
} from '../../storage/spriteStorage';
import { cleanSpriteData } from '../utils/cleanSpriteData';

/**
 * Adapter interface used to inject custom sprite storage implementations.
 */
export interface SpriteStorageController {
  /** Lists saved sprite summaries. */
  listSprites: () => Promise<SpriteSummary[]>;
  /** Loads a stored sprite by id. */
  loadSprite: (id: string) => Promise<StoredSprite | null>;
  /** Persists sprite data to storage. */
  saveSprite: typeof defaultSaveSprite;
  /** Deletes a sprite by id. */
  deleteSprite: (id: string) => Promise<void>;
}

/**
 * Options for {@link useSpriteStorage}.
 */
export interface UseSpriteStorageOptions {
  /** Editor instance used for export/import. */
  editor: SpriteEditorApi;
  /** Optional controller override. */
  controller?: SpriteStorageController;
  /** Called when a sprite is successfully saved. */
  onSpriteSaved?: (summary: SpriteSummary) => void;
  /** Called when a sprite is loaded. */
  onSpriteLoaded?: (summary: SpriteSummary) => void;
}

/**
 * Result returned by {@link useSpriteStorage}.
 */
export interface UseSpriteStorageResult {
  /** Cached list of stored sprites. */
  sprites: SpriteSummary[];
  /** Status or error message for UI display. */
  status: string | null;
  /** Indicates whether a storage operation is pending. */
  isBusy: boolean;
  /** Reloads the list of stored sprites. */
  refresh: () => Promise<void>;
  /** Saves the current editor state as a new sprite. */
  saveSpriteAs: (name: string) => Promise<SpriteSummary | null>;
  /** Loads a sprite by id into the editor. */
  loadSpriteById: (id: string) => Promise<SpriteSummary | null>;
  /** Overwrites an existing sprite entry. */
  overwriteSprite: (id: string, displayName: string) => Promise<SpriteSummary | null>;
  /** Renames a stored sprite. */
  renameSprite: (id: string, name: string) => Promise<SpriteSummary | null>;
  /** Deletes a sprite and reports success. */
  deleteSpriteById: (id: string, displayName: string) => Promise<boolean>;
  /** Loads the full sprite payload without mutating editor state (for previews). */
  fetchSpriteById: (id: string) => Promise<StoredSprite | null>;
}

const toSummary = (stored: StoredSprite): SpriteSummary => ({
  id: stored.id,
  displayName: stored.meta.displayName,
  createdAt: stored.meta.createdAt,
  updatedAt: stored.meta.updatedAt,
});

const defaultController: SpriteStorageController = {
  listSprites: defaultListSprites,
  loadSprite: defaultLoadSprite,
  saveSprite: defaultSaveSprite,
  deleteSprite: defaultDeleteSprite,
};

const toSpriteData = (stored: StoredSprite): SpriteData => ({
  frames: stored.frames as SpriteFrame[],
  animations: stored.animations as SpriteAnimations | undefined,
  animationsMeta: stored.animationsMeta as SpriteAnimationsMeta | undefined,
  meta: stored.meta,
});

const coerceTimestamp = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? (value as number) : undefined;

/**
 * Hook that wires the editor API to the sprite storage helpers.
 */
export const useSpriteStorage = ({
  editor,
  controller,
  onSpriteLoaded,
  onSpriteSaved,
}: UseSpriteStorageOptions): UseSpriteStorageResult => {
  const storage = controller ?? defaultController;
  const [sprites, setSprites] = useState<SpriteSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const items = await storage.listSprites();
      setSprites(items);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveSpriteAs = useCallback(
    async (name: string) => {
      if (!editor.state.frames.length) {
        setStatus('Add at least one frame before saving.');
        return null;
      }
      const trimmedName = name.trim() || 'Untitled Sprite';
      setIsBusy(true);
      try {
        const payload = cleanSpriteData(editor.exportJSON() as any);
        const now = Date.now();
        const stored = await storage.saveSprite({
          sprite: {
            ...payload,
            meta: {
              ...(payload.meta ?? {}),
              displayName: trimmedName,
              createdAt: coerceTimestamp(payload.meta?.createdAt) ?? now,
              updatedAt: now,
            },
          },
        });
        editor.updateMeta({
          displayName: trimmedName,
          createdAt: stored.meta.createdAt,
          updatedAt: stored.meta.updatedAt,
        });
        const summary = toSummary(stored);
        setStatus(`Saved sprite ${trimmedName}.`);
        onSpriteSaved?.(summary);
        await refresh();
        return summary;
      } catch (error) {
        setStatus((error as Error).message);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [editor, onSpriteSaved, refresh, storage],
  );

  const loadSpriteById = useCallback(
    async (id: string) => {
      setIsBusy(true);
      try {
        const stored = await storage.loadSprite(id);
        if (!stored) {
          setStatus('Sprite not found on disk.');
          return null;
        }
        const data = toSpriteData(stored);
        editor.importJSON(data);
        if (typeof stored.autoPlayAnimation === 'string') {
          editor.setAutoPlayAnimation(stored.autoPlayAnimation);
        }
        const displayName =
          typeof stored.meta?.displayName === 'string' ? stored.meta.displayName : 'Loaded sprite';
        const nextMeta: Record<string, unknown> = { displayName };
        if (typeof stored.meta?.createdAt === 'number') {
          nextMeta.createdAt = stored.meta.createdAt;
        }
        if (typeof stored.meta?.updatedAt === 'number') {
          nextMeta.updatedAt = stored.meta.updatedAt;
        }
        editor.updateMeta(nextMeta);
        const summary = toSummary(stored);
        setStatus(`Loaded sprite ${stored.meta.displayName}.`);
        onSpriteLoaded?.(summary);
        return summary;
      } catch (error) {
        setStatus((error as Error).message);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [editor, onSpriteLoaded, storage],
  );

  const overwriteSprite = useCallback(
    async (id: string, displayName: string) => {
      if (!editor.state.frames.length) {
        setStatus('Add at least one frame before saving.');
        return null;
      }
      setIsBusy(true);
      try {
        const payload = cleanSpriteData(editor.exportJSON() as any);
        const stored = await storage.loadSprite(id);
        if (!stored) {
          setStatus('Sprite not found on disk.');
          return null;
        }
        const now = Date.now();
        const result = await storage.saveSprite({
            sprite: {
              ...payload,
              id,
              meta: {
                ...(payload.meta ?? {}),
                displayName,
                createdAt: coerceTimestamp(stored.meta.createdAt) ?? now,
                updatedAt: now,
              },
            },
        });
        const summary = toSummary(result);
        editor.updateMeta({
          displayName,
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt,
        });
        setStatus(`Overwrote sprite ${displayName}.`);
        onSpriteSaved?.(summary);
        await refresh();
        return summary;
      } catch (error) {
        setStatus((error as Error).message);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [editor, onSpriteSaved, refresh, storage],
  );

  const renameSprite = useCallback(
    async (id: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) {
        setStatus('Name cannot be empty.');
        return null;
      }
      setIsBusy(true);
      try {
        const stored = await storage.loadSprite(id);
        if (!stored) {
          setStatus('Sprite not found on disk.');
          return null;
        }
        const result = await storage.saveSprite({
          sprite: {
            id: stored.id,
            frames: stored.frames as SpriteFrame[],
            animations: stored.animations as SpriteAnimations | undefined,
            animationsMeta: stored.animationsMeta as SpriteAnimationsMeta | undefined,
            meta: {
              ...stored.meta,
              displayName: trimmed,
              createdAt: coerceTimestamp(stored.meta.createdAt) ?? stored.meta.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            },
          },
        });
        const summary = toSummary(result);
        setStatus(`Renamed sprite to ${trimmed}.`);
        await refresh();
        return summary;
      } catch (error) {
        setStatus((error as Error).message);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [refresh, storage],
  );

  const deleteSpriteById = useCallback(
    async (id: string, displayName: string) => {
      setIsBusy(true);
      try {
        await storage.deleteSprite(id);
        setStatus(`Deleted sprite ${displayName}.`);
        await refresh();
        return true;
      } catch (error) {
        setStatus((error as Error).message);
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [refresh, storage],
  );

  const fetchSpriteById = useCallback(
    async (id: string) => {
      try {
        return await storage.loadSprite(id);
      } catch (error) {
        setStatus((error as Error).message);
        return null;
      }
    },
    [storage],
  );

  return {
    sprites,
    status,
    isBusy,
    refresh,
    saveSpriteAs,
    loadSpriteById,
    overwriteSprite,
    renameSprite,
    deleteSpriteById,
    fetchSpriteById,
  };
};
