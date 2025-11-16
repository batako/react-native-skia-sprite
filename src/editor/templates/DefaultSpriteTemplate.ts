import type { SpriteData } from '../../SpriteAnimator';
import type { SpriteEditorSnapshot } from '../types';
import { cloneSnapshot, createFrameId } from '../utils/state';

const stripFrameIds = (frames: SpriteEditorSnapshot['frames']): SpriteData['frames'] => {
  return frames.map(({ id: _id, duration: _duration, ...rest }) => ({ ...rest }));
};

const withFrameIds = (frames: SpriteData['frames']): SpriteEditorSnapshot['frames'] => {
  return (frames ?? []).map((frame) => {
    const { duration: _duration, ...rest } = frame;
    return {
      ...rest,
      id: createFrameId(),
    };
  });
};

/**
 * Serialization helpers that mirror the spriteStorage payload.
 */
export const DefaultSpriteTemplate = {
  toJSON: (state: SpriteEditorSnapshot): SpriteData => {
    const snapshot = cloneSnapshot(state);
    return {
      frames: stripFrameIds(snapshot.frames),
      animations: snapshot.animations,
      animationsMeta: snapshot.animationsMeta,
      meta: snapshot.meta,
    };
  },
  fromJSON: (data?: SpriteData | null): Partial<SpriteEditorSnapshot> | null => {
    if (!data || !Array.isArray(data.frames)) {
      return null;
    }
    return {
      frames: withFrameIds(data.frames),
      animations: data.animations ?? {},
      animationsMeta: data.animationsMeta,
      selected: [],
      meta: data.meta ?? {},
    };
  },
};
