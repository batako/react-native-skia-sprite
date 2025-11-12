import type { SpriteData } from '../../SpriteAnimator';
import type { SpriteEditorSnapshot } from '../types';
import { cloneSnapshot, createFrameId } from '../utils/state';
import type { SpriteTemplate } from './SpriteTemplate';

const stripFrameIds = (frames: SpriteEditorSnapshot['frames']): SpriteData['frames'] => {
  return frames.map(({ id: _id, ...rest }) => ({ ...rest }));
};

const withFrameIds = (frames: SpriteData['frames']): SpriteEditorSnapshot['frames'] => {
  return (frames ?? []).map((frame) => ({
    ...frame,
    id: createFrameId(),
  }));
};

/**
 * Default template that mirrors the spriteStorage payload (v0.2 schema).
 */
export const DefaultSpriteTemplate: SpriteTemplate<SpriteData> = {
  name: 'spriteStorage',
  version: 2,
  toJSON: (state) => {
    const snapshot = cloneSnapshot(state);
    return {
      frames: stripFrameIds(snapshot.frames),
      animations: snapshot.animations,
      animationsMeta: snapshot.animationsMeta,
      meta: snapshot.meta,
    } satisfies SpriteData;
  },
  fromJSON: (data) => {
    if (!data || !Array.isArray(data.frames)) {
      return null;
    }
    return {
      frames: withFrameIds(data.frames),
      animations: data.animations ?? {},
      animationsMeta: data.animationsMeta,
      selected: [],
      meta: data.meta ?? {},
    } satisfies Partial<SpriteEditorSnapshot>;
  },
};
