import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpriteAnimations, SpriteAnimationsMeta, SpriteData } from '../../SpriteAnimator';
import { DefaultSpriteTemplate } from '../templates/DefaultSpriteTemplate';
import type {
  SpriteEditorFrame,
  SpriteEditorMeta,
  SpriteEditorSelection,
  SpriteEditorSnapshot,
  SpriteEditorState,
} from '../types';
import {
  cloneAnimations,
  cloneAnimationsMeta,
  cloneFrames,
  createFrameId,
  snapshotFromState,
} from '../utils/state';

/** Default number of snapshots retained in the undo history. */
const DEFAULT_HISTORY_LIMIT = 50;

/** Produces a new editor state derived from the previous snapshot. */
type SnapshotProducer = (prev: SpriteEditorState) => SpriteEditorState | null;

/** Options that control whether a state change should be recorded in history. */
type HistoryOptions = {
  /** When false, skips pushing the previous snapshot into the undo stack. */
  recordHistory?: boolean;
};

/** Configuration object accepted by the `useSpriteEditor` hook. */
export interface UseSpriteEditorOptions {
  /** Optional initial state used to seed the hook. */
  initialState?: Partial<SpriteEditorState>;
  /** Maximum number of undo snapshots tracked in memory. */
  historyLimit?: number;
  /** When true, selection changes participate in undo/redo. Defaults to false. */
  trackSelectionInHistory?: boolean;
}

/** Additional options for `addFrame`. */
export interface AddFrameOptions {
  /** Zero-based index where the frame should be inserted. Defaults to the end. */
  index?: number;
}

/** Additional options for clipboard paste operations. */
export interface PasteOptions {
  /** Optional insertion index overriding the default paste location. */
  index?: number;
}

/** Options that control how `setSelection` behaves. */
export interface SetSelectionOptions {
  /** When true, the provided ids are appended to the existing selection. */
  append?: boolean;
}

/** Options that control the behavior of `selectFrame`. */
export interface SelectFrameOptions {
  /** When true, the frame is added to the selection if not already present. */
  additive?: boolean;
  /** When true, toggles the frame instead of forcing it on. */
  toggle?: boolean;
}

/** Public API returned by the `useSpriteEditor` hook. */
export interface SpriteEditorApi {
  /** Latest editor state snapshot. */
  state: SpriteEditorState;
  /** Inserts a frame and returns the created value (with generated id). */
  addFrame: (
    frame: Omit<SpriteEditorFrame, 'id'> & Partial<Pick<SpriteEditorFrame, 'id'>>,
    options?: AddFrameOptions,
  ) => SpriteEditorFrame;
  /** Applies partial updates to an existing frame. */
  updateFrame: (
    id: string,
    updates: Partial<Omit<SpriteEditorFrame, 'id'>>,
  ) => SpriteEditorFrame | null;
  /** Removes a single frame by id. */
  removeFrame: (id: string) => void;
  /** Removes multiple frames at once. */
  removeFrames: (ids: string[]) => void;
  /** Reorders frames by moving a frame from one index to another. */
  reorderFrames: (fromIndex: number, toIndex: number) => void;
  /** Replaces the selection with the provided frame ids. */
  setSelection: (ids: SpriteEditorSelection, options?: SetSelectionOptions) => void;
  /** Selects or toggles a single frame. */
  selectFrame: (id: string, options?: SelectFrameOptions) => void;
  /** Clears the current selection. */
  clearSelection: () => void;
  /** Marks every frame as selected. */
  selectAll: () => void;
  /** Copies the currently selected frames into the clipboard buffer. */
  copySelected: () => void;
  /** Copies and removes the currently selected frames. */
  cutSelected: () => void;
  /** Pastes the clipboard content at the derived or provided index. */
  pasteClipboard: (options?: PasteOptions) => void;
  /** Steps backward in history if possible. */
  undo: () => void;
  /** Steps forward in history if possible. */
  redo: () => void;
  /** Whether undo is currently possible. */
  canUndo: boolean;
  /** Whether redo is currently possible. */
  canRedo: boolean;
  /** Serialises the state into spriteStorage-compatible JSON. */
  exportJSON: () => SpriteData;
  /** Imports editor state from spriteStorage-compatible JSON. */
  importJSON: (payload: SpriteData) => void;
  /** Replaces the animation map. */
  setAnimations: (animations: SpriteAnimations) => void;
  /** Replaces the animation meta map. */
  setAnimationsMeta: (meta?: SpriteAnimationsMeta) => void;
  /** Partially updates sprite metadata. */
  updateMeta: (meta: Partial<SpriteEditorMeta>) => void;
  /** Resets the editor with a partial state. */
  reset: (nextState?: Partial<SpriteEditorState>) => void;
}

/**
 * Clamps a numeric value between the provided boundaries.
 */
const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

/**
 * Ensures the provided history limit is a finite positive integer.
 */
const ensureHistoryLimit = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.floor(value);
};

/**
 * Normalises the initial state passed to the hook.
 */
const createInitialState = (input?: Partial<SpriteEditorState>): SpriteEditorState => {
  const frames = cloneFrames(input?.frames ?? []);
  const selectionSet = new Set(frames.map((frame) => frame.id));
  const selected = (input?.selected ?? []).filter((id) => selectionSet.has(id));
  return {
    frames,
    animations: cloneAnimations(input?.animations ?? {}),
    animationsMeta: cloneAnimationsMeta(input?.animationsMeta),
    selected,
    clipboard: cloneFrames(input?.clipboard ?? []),
    history: [],
    future: [],
    meta: { ...(input?.meta ?? {}) },
  };
};

/**
 * Filters selection ids so only frames present in the editor remain selected.
 */
const sanitizeSelection = (frames: SpriteEditorFrame[], selected: SpriteEditorSelection) => {
  if (!selected.length) return [];
  const allowed = new Set(frames.map((frame) => frame.id));
  return selected.filter((id) => allowed.has(id));
};

/**
 * Shallow equality helper used to avoid redundant selection updates.
 */
const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

/**
 * Offsets animation indexes when frames are inserted.
 */
const shiftAnimationIndexes = (
  animations: SpriteAnimations,
  startIndex: number,
  delta: number,
): SpriteAnimations => {
  if (!delta) {
    return animations;
  }
  const next: SpriteAnimations = {};
  Object.entries(animations).forEach(([name, sequence]) => {
    next[name] = sequence.map((value) => (value >= startIndex ? value + delta : value));
  });
  return next;
};

/**
 * Removes the provided frame index from all animation sequences.
 */
const removeIndexFromAnimations = (
  animations: SpriteAnimations,
  removedIndex: number,
): SpriteAnimations => {
  const next: SpriteAnimations = {};
  Object.entries(animations).forEach(([name, sequence]) => {
    const filtered: number[] = [];
    sequence.forEach((value) => {
      if (value === removedIndex) {
        return;
      }
      filtered.push(value > removedIndex ? value - 1 : value);
    });
    if (filtered.length) {
      next[name] = filtered;
    }
  });
  return next;
};

/**
 * Drops metadata entries that no longer have a matching animation.
 */
const syncAnimationsMeta = (
  animations: SpriteAnimations,
  meta?: SpriteAnimationsMeta,
): SpriteAnimationsMeta | undefined => {
  if (!meta) {
    return undefined;
  }
  const next: SpriteAnimationsMeta = {};
  Object.keys(animations).forEach((name) => {
    if (meta[name]) {
      next[name] = { ...meta[name]! };
    }
  });
  return Object.keys(next).length ? next : undefined;
};

/**
 * Looks up the array index for a frame id.
 */
const findFrameIndex = (frames: SpriteEditorFrame[], id: string) => {
  return frames.findIndex((frame) => frame.id === id);
};

/**
 * Resolves selection ids into sorted frame indexes.
 */
const resolveSelectionIndexes = (frames: SpriteEditorFrame[], selected: SpriteEditorSelection) => {
  return selected
    .map((id) => findFrameIndex(frames, id))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
};

/**
 * Applies a snapshot to the current state reference.
 */
const applySnapshot = (
  state: SpriteEditorState,
  snapshot: SpriteEditorSnapshot,
): SpriteEditorState => ({
  ...state,
  frames: cloneFrames(snapshot.frames),
  animations: cloneAnimations(snapshot.animations),
  animationsMeta: cloneAnimationsMeta(snapshot.animationsMeta),
  selected: [...snapshot.selected],
  meta: { ...snapshot.meta },
});

/**
 * Central hook that exposes headless sprite editing helpers.
 */
export const useSpriteEditor = (options: UseSpriteEditorOptions = {}): SpriteEditorApi => {
  const historyLimitRef = useRef(ensureHistoryLimit(options.historyLimit));
  const trackSelectionRef = useRef(Boolean(options.trackSelectionInHistory));

  useEffect(() => {
    historyLimitRef.current = ensureHistoryLimit(options.historyLimit);
  }, [options.historyLimit]);

  useEffect(() => {
    trackSelectionRef.current = Boolean(options.trackSelectionInHistory);
  }, [options.trackSelectionInHistory]);

  const [state, setState] = useState<SpriteEditorState>(() =>
    createInitialState(options.initialState),
  );

  const apply = useCallback((producer: SnapshotProducer, opts?: HistoryOptions) => {
    setState((prev) => {
      const next = producer(prev);
      if (!next || next === prev) {
        return prev;
      }
      if (opts?.recordHistory === false) {
        return {
          ...next,
          history: prev.history,
          future: prev.future,
        };
      }
      const snapshot = snapshotFromState(prev);
      const limit = historyLimitRef.current;
      const history = [...prev.history, snapshot];
      const trimmed =
        limit > 0 && history.length > limit ? history.slice(history.length - limit) : history;
      return {
        ...next,
        history: trimmed,
        future: [],
      };
    });
  }, []);

  /** Inserts a frame and keeps animations in sync. */
  const addFrame = useCallback<SpriteEditorApi['addFrame']>(
    (frame, opts) => {
      const resolvedId = frame.id ?? createFrameId();
      const newFrame: SpriteEditorFrame = { ...frame, id: resolvedId } as SpriteEditorFrame;
      apply((prev) => {
        const targetIndex = typeof opts?.index === 'number' ? opts.index : prev.frames.length;
        const sanitizedIndex = clamp(targetIndex, 0, prev.frames.length);
        const frames = [...prev.frames];
        frames.splice(sanitizedIndex, 0, newFrame);
        const animations = shiftAnimationIndexes(prev.animations, sanitizedIndex, 1);
        return {
          ...prev,
          frames,
          animations,
          animationsMeta: syncAnimationsMeta(animations, prev.animationsMeta),
          selected: [newFrame.id],
        };
      });
      return newFrame;
    },
    [apply],
  );

  /** Applies partial updates to a specific frame. */
  const updateFrame = useCallback<SpriteEditorApi['updateFrame']>(
    (id, updates) => {
      let result: SpriteEditorFrame | null = null;
      apply(
        (prev) => {
          const index = findFrameIndex(prev.frames, id);
          if (index < 0) {
            return prev;
          }
          const frames = [...prev.frames];
          const nextFrame = { ...frames[index], ...updates, id } as SpriteEditorFrame;
          frames[index] = nextFrame;
          result = nextFrame;
          return {
            ...prev,
            frames,
          };
        },
        { recordHistory: true },
      );
      return result;
    },
    [apply],
  );

  /** Removes multiple frames and keeps animations + selection aligned. */
  const removeFrames = useCallback<SpriteEditorApi['removeFrames']>(
    (ids) => {
      if (!ids.length) return;
      apply((prev) => {
        const indexes = ids
          .map((id) => findFrameIndex(prev.frames, id))
          .filter((index) => index >= 0)
          .sort((a, b) => b - a);
        if (!indexes.length) {
          return prev;
        }
        const frames = [...prev.frames];
        let animations = { ...prev.animations };
        indexes.forEach((index) => {
          frames.splice(index, 1);
          animations = removeIndexFromAnimations(animations, index);
        });
        const animationsMeta = syncAnimationsMeta(animations, prev.animationsMeta);
        const removalSet = new Set(ids);
        const selected = prev.selected.filter((id) => !removalSet.has(id));
        return {
          ...prev,
          frames,
          animations,
          animationsMeta,
          selected,
        };
      });
    },
    [apply],
  );

  /** Removes a single frame via the batch helper. */
  const removeFrame = useCallback<SpriteEditorApi['removeFrame']>(
    (id) => {
      removeFrames([id]);
    },
    [removeFrames],
  );

  /** Moves a frame to a different index. */
  const reorderFrames = useCallback<SpriteEditorApi['reorderFrames']>(
    (from, to) => {
      apply((prev) => {
        if (from === to) {
          return prev;
        }
        if (from < 0 || from >= prev.frames.length || !prev.frames.length) {
          return prev;
        }
        const target = clamp(to, 0, prev.frames.length - 1);
        const frames = [...prev.frames];
        const [moved] = frames.splice(from, 1);
        if (!moved) {
          return prev;
        }
        frames.splice(target, 0, moved);
        return {
          ...prev,
          frames,
        };
      });
    },
    [apply],
  );

  /** Replaces or appends to the selection set. */
  const setSelection = useCallback<SpriteEditorApi['setSelection']>(
    (ids, opts) => {
      apply(
        (prev) => {
          const merged = opts?.append ? [...prev.selected, ...ids] : [...ids];
          const next = sanitizeSelection(prev.frames, Array.from(new Set(merged)));
          if (arraysEqual(next, prev.selected)) {
            return prev;
          }
          return {
            ...prev,
            selected: next,
          };
        },
        { recordHistory: trackSelectionRef.current },
      );
    },
    [apply],
  );

  /** Handles additive/toggle selection for single frames. */
  const selectFrame = useCallback<SpriteEditorApi['selectFrame']>(
    (id, opts) => {
      apply(
        (prev) => {
          const alreadySelected = prev.selected.includes(id);
          let nextSelected: string[];
          if (opts?.toggle) {
            nextSelected = alreadySelected
              ? prev.selected.filter((value) => value !== id)
              : [...prev.selected, id];
          } else if (opts?.additive) {
            nextSelected = alreadySelected ? prev.selected : [...prev.selected, id];
          } else {
            nextSelected = [id];
          }
          const sanitized = sanitizeSelection(prev.frames, nextSelected);
          if (arraysEqual(sanitized, prev.selected)) {
            return prev;
          }
          return {
            ...prev,
            selected: sanitized,
          };
        },
        { recordHistory: trackSelectionRef.current },
      );
    },
    [apply],
  );

  /** Clears any active selection. */
  const clearSelection = useCallback(() => {
    apply(
      (prev) => {
        if (!prev.selected.length) {
          return prev;
        }
        return { ...prev, selected: [] };
      },
      { recordHistory: trackSelectionRef.current },
    );
  }, [apply]);

  /** Selects all frames currently present. */
  const selectAll = useCallback(() => {
    apply(
      (prev) => {
        const ids = prev.frames.map((frame) => frame.id);
        if (arraysEqual(ids, prev.selected)) {
          return prev;
        }
        return { ...prev, selected: ids };
      },
      { recordHistory: trackSelectionRef.current },
    );
  }, [apply]);

  /** Copies selection into the clipboard buffer. */
  const copySelected = useCallback(() => {
    apply(
      (prev) => {
        const selectedFrames = prev.selected
          .map((id) => prev.frames.find((frame) => frame.id === id))
          .filter((frame): frame is SpriteEditorFrame => Boolean(frame));
        if (!selectedFrames.length) {
          return prev;
        }
        return {
          ...prev,
          clipboard: cloneFrames(selectedFrames),
        };
      },
      { recordHistory: false },
    );
  }, [apply]);

  /** Performs a copy followed by removal of the selected frames. */
  const cutSelected = useCallback(() => {
    copySelected();
    removeFrames(state.selected);
  }, [copySelected, removeFrames, state.selected]);

  /** Pastes clipboard frames at the inferred or provided index. */
  const pasteClipboard = useCallback<SpriteEditorApi['pasteClipboard']>(
    (opts) => {
      apply((prev) => {
        if (!prev.clipboard.length) {
          return prev;
        }
        const indexFromSelection = resolveSelectionIndexes(prev.frames, prev.selected);
        const fallbackIndex = prev.frames.length;
        const insertIndex =
          typeof opts?.index === 'number'
            ? clamp(opts.index, 0, prev.frames.length)
            : indexFromSelection.length
              ? Math.max(...indexFromSelection) + 1
              : fallbackIndex;
        const frames = [...prev.frames];
        const clones = prev.clipboard.map((frame) => ({
          ...frame,
          id: createFrameId(),
        }));
        frames.splice(insertIndex, 0, ...clones);
        const animations = shiftAnimationIndexes(prev.animations, insertIndex, clones.length);
        return {
          ...prev,
          frames,
          animations,
          animationsMeta: syncAnimationsMeta(animations, prev.animationsMeta),
          selected: clones.map((frame) => frame.id),
        };
      });
    },
    [apply],
  );

  /** Steps backward in history if possible. */
  const undo = useCallback(() => {
    setState((prev) => {
      if (!prev.history.length) {
        return prev;
      }
      const history = [...prev.history];
      const snapshot = history.pop()!;
      const future = [snapshotFromState(prev), ...prev.future];
      return {
        ...applySnapshot(prev, snapshot),
        clipboard: prev.clipboard,
        history,
        future,
      };
    });
  }, []);

  /** Steps forward in history if possible. */
  const redo = useCallback(() => {
    setState((prev) => {
      if (!prev.future.length) {
        return prev;
      }
      const [nextSnapshot, ...restFuture] = prev.future;
      const history = [...prev.history, snapshotFromState(prev)];
      return {
        ...applySnapshot(prev, nextSnapshot),
        clipboard: prev.clipboard,
        history,
        future: restFuture,
      };
    });
  }, []);

  /** Serialises the current editor state into spriteStorage-compatible JSON. */
  const exportJSON = useCallback((): SpriteData => {
    return DefaultSpriteTemplate.toJSON(state);
  }, [state]);

  /** Imports spriteStorage-compatible JSON and resets history. */
  const importJSON = useCallback(
    (payload: SpriteData) => {
      const snapshot = DefaultSpriteTemplate.fromJSON(payload);
      if (!snapshot) {
        return;
      }
      apply((prev) => {
        const frames = cloneFrames(snapshot.frames ?? []);
        const selected = sanitizeSelection(frames, snapshot.selected ?? []);
        return {
          ...prev,
          frames,
          animations: cloneAnimations(snapshot.animations ?? {}),
          animationsMeta: cloneAnimationsMeta(snapshot.animationsMeta),
          selected,
          clipboard: [],
          meta: { ...(snapshot.meta ?? {}) },
        };
      });
    },
    [apply],
  );

  /** Replaces the animation definition map with a cloned version. */
  const setAnimations = useCallback<SpriteEditorApi['setAnimations']>(
    (animations) => {
      apply((prev) => {
        const nextAnimations = cloneAnimations(animations);
        return {
          ...prev,
          animations: nextAnimations,
          animationsMeta: syncAnimationsMeta(nextAnimations, prev.animationsMeta),
        };
      });
    },
    [apply],
  );

  /** Replaces the animation metadata map. */
  const setAnimationsMeta = useCallback<SpriteEditorApi['setAnimationsMeta']>(
    (meta) => {
      apply((prev) => ({
        ...prev,
        animationsMeta: cloneAnimationsMeta(meta),
      }));
    },
    [apply],
  );

  /** Merges the provided metadata into the existing object. */
  const updateMeta = useCallback<SpriteEditorApi['updateMeta']>(
    (meta) => {
      apply((prev) => ({
        ...prev,
        meta: { ...prev.meta, ...meta },
      }));
    },
    [apply],
  );

  /** Resets the entire editor state and history buffers. */
  const reset = useCallback<SpriteEditorApi['reset']>((nextState) => {
    setState(createInitialState(nextState));
  }, []);

  const api = useMemo<SpriteEditorApi>(
    () => ({
      state,
      addFrame,
      updateFrame,
      removeFrame,
      removeFrames,
      reorderFrames,
      setSelection,
      selectFrame,
      clearSelection,
      selectAll,
      copySelected,
      cutSelected,
      pasteClipboard,
      undo,
      redo,
      canUndo: state.history.length > 0,
      canRedo: state.future.length > 0,
      exportJSON,
      importJSON,
      setAnimations,
      setAnimationsMeta,
      updateMeta,
      reset,
    }),
    [
      state,
      addFrame,
      updateFrame,
      removeFrame,
      removeFrames,
      reorderFrames,
      setSelection,
      selectFrame,
      clearSelection,
      selectAll,
      copySelected,
      cutSelected,
      pasteClipboard,
      undo,
      redo,
      exportJSON,
      importJSON,
      setAnimations,
      setAnimationsMeta,
      updateMeta,
      reset,
    ],
  );

  return api;
};
