import type { SpriteAnimations, SpriteAnimationsMeta } from '../../SpriteAnimator';
import type { SpriteEditorFrame, SpriteEditorSnapshot, SpriteEditorState } from '../types';

export const createFrameId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `frame_${Math.random().toString(36).slice(2, 10)}`;
};

export const cloneFrame = (frame: SpriteEditorFrame): SpriteEditorFrame => ({
  ...frame,
});

export const cloneFrames = (frames: SpriteEditorFrame[]) => frames.map(cloneFrame);

export const cloneAnimations = (animations: SpriteAnimations) => {
  const next: SpriteAnimations = {};
  Object.entries(animations).forEach(([name, sequence]) => {
    next[name] = Array.isArray(sequence) ? [...sequence] : [];
  });
  return next;
};

export const cloneAnimationsMeta = (meta?: SpriteAnimationsMeta) => {
  if (!meta) return undefined;
  const next: SpriteAnimationsMeta = {};
  Object.entries(meta).forEach(([name, value]) => {
    next[name] = value ? { ...value } : {};
  });
  return next;
};

export const cloneSnapshot = (
  snapshot: SpriteEditorSnapshot,
): SpriteEditorSnapshot => ({
  frames: cloneFrames(snapshot.frames),
  animations: cloneAnimations(snapshot.animations),
  animationsMeta: cloneAnimationsMeta(snapshot.animationsMeta),
  selected: [...snapshot.selected],
  meta: { ...snapshot.meta },
});

export const snapshotFromState = (state: SpriteEditorState): SpriteEditorSnapshot => ({
  frames: cloneFrames(state.frames),
  animations: cloneAnimations(state.animations),
  animationsMeta: cloneAnimationsMeta(state.animationsMeta),
  selected: [...state.selected],
  meta: { ...state.meta },
});
