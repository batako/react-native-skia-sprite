import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpriteAnimations, SpriteAnimationsMeta } from '../../SpriteAnimator';
import type { SpriteTemplate } from '../templates/SpriteTemplate';
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

const DEFAULT_HISTORY_LIMIT = 50;

type SnapshotProducer = (prev: SpriteEditorState) => SpriteEditorState | null;

type HistoryOptions = {
  recordHistory?: boolean;
};

export interface UseSpriteEditorOptions {
  /** Optional initial state used to seed the hook. */
  initialState?: Partial<SpriteEditorState>;
  /** Maximum number of undo snapshots tracked in memory. */
  historyLimit?: number;
  /** Default template used by export/import helpers. */
  template?: SpriteTemplate;
  /** When true, selection changes participate in undo/redo. Defaults to false. */
  trackSelectionInHistory?: boolean;
}

export interface AddFrameOptions {
  index?: number;
}

export interface PasteOptions {
  index?: number;
}

export interface SpriteEditorApi {
  state: SpriteEditorState;
  addFrame: (frame: Omit<SpriteEditorFrame, 'id'> & Partial<Pick<SpriteEditorFrame, 'id'>>, options?: AddFrameOptions) => SpriteEditorFrame;
  updateFrame: (id: string, updates: Partial<Omit<SpriteEditorFrame, 'id'>>) => SpriteEditorFrame | null;
  removeFrame: (id: string) => void;
  removeFrames: (ids: string[]) => void;
  reorderFrames: (fromIndex: number, toIndex: number) => void;
  setSelection: (ids: SpriteEditorSelection, options?: { append?: boolean }) => void;
  selectFrame: (id: string, options?: { additive?: boolean; toggle?: boolean }) => void;
  clearSelection: () => void;
  selectAll: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: (options?: PasteOptions) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exportJSON: <TData = unknown>(template?: SpriteTemplate<TData>) => TData;
  importJSON: <TData = unknown>(payload: TData, template?: SpriteTemplate<TData>) => void;
  setAnimations: (animations: SpriteAnimations) => void;
  setAnimationsMeta: (meta?: SpriteAnimationsMeta) => void;
  updateMeta: (meta: Partial<SpriteEditorMeta>) => void;
  reset: (nextState?: Partial<SpriteEditorState>) => void;
  template: SpriteTemplate<any>;
}

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const ensureHistoryLimit = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.floor(value);
};

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

const sanitizeSelection = (frames: SpriteEditorFrame[], selected: SpriteEditorSelection) => {
  if (!selected.length) return [];
  const allowed = new Set(frames.map((frame) => frame.id));
  return selected.filter((id) => allowed.has(id));
};

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

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

const findFrameIndex = (frames: SpriteEditorFrame[], id: string) => {
  return frames.findIndex((frame) => frame.id === id);
};

const resolveSelectionIndexes = (frames: SpriteEditorFrame[], selected: SpriteEditorSelection) => {
  return selected
    .map((id) => findFrameIndex(frames, id))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
};

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

export const useSpriteEditor = (options: UseSpriteEditorOptions = {}): SpriteEditorApi => {
  const historyLimitRef = useRef(ensureHistoryLimit(options.historyLimit));
  const templateRef = useRef<SpriteTemplate<any>>(options.template ?? DefaultSpriteTemplate);
  const trackSelectionRef = useRef(Boolean(options.trackSelectionInHistory));

  useEffect(() => {
    historyLimitRef.current = ensureHistoryLimit(options.historyLimit);
  }, [options.historyLimit]);

  useEffect(() => {
    templateRef.current = options.template ?? DefaultSpriteTemplate;
  }, [options.template]);

  useEffect(() => {
    trackSelectionRef.current = Boolean(options.trackSelectionInHistory);
  }, [options.trackSelectionInHistory]);

  const [state, setState] = useState<SpriteEditorState>(() => createInitialState(options.initialState));

  const apply = useCallback(
    (producer: SnapshotProducer, opts?: HistoryOptions) => {
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
    },
    [],
  );

  const addFrame = useCallback<SpriteEditorApi['addFrame']>((frame, opts) => {
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
  }, [apply]);

  const updateFrame = useCallback<SpriteEditorApi['updateFrame']>((id, updates) => {
    let result: SpriteEditorFrame | null = null;
    apply((prev) => {
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
    }, { recordHistory: true });
    return result;
  }, [apply]);

  const removeFrames = useCallback<SpriteEditorApi['removeFrames']>((ids) => {
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
  }, [apply]);

  const removeFrame = useCallback<SpriteEditorApi['removeFrame']>((id) => {
    removeFrames([id]);
  }, [removeFrames]);

  const reorderFrames = useCallback<SpriteEditorApi['reorderFrames']>((from, to) => {
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
  }, [apply]);

  const setSelection = useCallback<SpriteEditorApi['setSelection']>((ids, opts) => {
    apply((prev) => {
      const merged = opts?.append ? [...prev.selected, ...ids] : [...ids];
      const next = sanitizeSelection(prev.frames, Array.from(new Set(merged)));
      if (arraysEqual(next, prev.selected)) {
        return prev;
      }
      return {
        ...prev,
        selected: next,
      };
    }, { recordHistory: trackSelectionRef.current });
  }, [apply]);

  const selectFrame = useCallback<SpriteEditorApi['selectFrame']>((id, opts) => {
    apply((prev) => {
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
    }, { recordHistory: trackSelectionRef.current });
  }, [apply]);

  const clearSelection = useCallback(() => {
    apply((prev) => {
      if (!prev.selected.length) {
        return prev;
      }
      return { ...prev, selected: [] };
    }, { recordHistory: trackSelectionRef.current });
  }, [apply]);

  const selectAll = useCallback(() => {
    apply((prev) => {
      const ids = prev.frames.map((frame) => frame.id);
      if (arraysEqual(ids, prev.selected)) {
        return prev;
      }
      return { ...prev, selected: ids };
    }, { recordHistory: trackSelectionRef.current });
  }, [apply]);

  const copySelected = useCallback(() => {
    apply((prev) => {
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
    }, { recordHistory: false });
  }, [apply]);

  const cutSelected = useCallback(() => {
    copySelected();
    removeFrames(state.selected);
  }, [copySelected, removeFrames, state.selected]);

  const pasteClipboard = useCallback<SpriteEditorApi['pasteClipboard']>((opts) => {
    apply((prev) => {
      if (!prev.clipboard.length) {
        return prev;
      }
      const indexFromSelection = resolveSelectionIndexes(prev.frames, prev.selected);
      const fallbackIndex = prev.frames.length;
      const insertIndex = typeof opts?.index === 'number'
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
  }, [apply]);

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

  const exportJSON = useCallback(<TData = unknown>(template?: SpriteTemplate<TData>) => {
    const activeTemplate = (template ?? templateRef.current) as SpriteTemplate<TData>;
    return activeTemplate.toJSON(state);
  }, [state]);

  const importJSON = useCallback(<TData = unknown>(payload: TData, template?: SpriteTemplate<TData>) => {
    const activeTemplate = (template ?? templateRef.current) as SpriteTemplate<TData>;
    if (typeof activeTemplate.fromJSON !== 'function') {
      throw new Error(`Template \"${activeTemplate.name}\" does not support fromJSON.`);
    }
    const snapshot = activeTemplate.fromJSON(payload);
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
  }, [apply]);

  const setAnimations = useCallback<SpriteEditorApi['setAnimations']>((animations) => {
    apply((prev) => {
      const nextAnimations = cloneAnimations(animations);
      return {
        ...prev,
        animations: nextAnimations,
        animationsMeta: syncAnimationsMeta(nextAnimations, prev.animationsMeta),
      };
    });
  }, [apply]);

  const setAnimationsMeta = useCallback<SpriteEditorApi['setAnimationsMeta']>((meta) => {
    apply((prev) => ({
      ...prev,
      animationsMeta: cloneAnimationsMeta(meta),
    }));
  }, [apply]);

  const updateMeta = useCallback<SpriteEditorApi['updateMeta']>((meta) => {
    apply((prev) => ({
      ...prev,
      meta: { ...prev.meta, ...meta },
    }));
  }, [apply]);

  const reset = useCallback<SpriteEditorApi['reset']>((nextState) => {
    setState(createInitialState(nextState));
  }, []);

  const api = useMemo<SpriteEditorApi>(() => ({
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
    template: templateRef.current,
  }), [
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
  ]);

  return api;
};
