/* eslint-disable jsdoc/require-jsdoc */
import type { DataSourceParam } from '@shopify/react-native-skia';
import type { SpriteEditorState } from '../types';
import type {
  AnimatedSpriteFrame,
  FrameImageSource,
  FrameImageSubset,
  SpriteAnimationsMap,
  SpriteAnimationsMetaMap,
  SpriteFramesResource,
} from '../animatedSprite2dTypes';

const buildFrameImageSource = (
  uri: string | undefined,
  subset?: FrameImageSubset,
): FrameImageSource | null => {
  if (typeof uri === 'string' && uri.length > 0) {
    return subset ? { type: 'uri', uri, subset } : { type: 'uri', uri };
  }
  return null;
};

const buildFromDataSource = (
  source: DataSourceParam | undefined,
  subset?: FrameImageSubset,
): FrameImageSource | null => {
  if (!source) {
    return null;
  }
  if (typeof source === 'number') {
    return subset
      ? { type: 'require', assetId: source, subset }
      : { type: 'require', assetId: source };
  }
  if (typeof source === 'string') {
    return subset ? { type: 'uri', uri: source, subset } : { type: 'uri', uri: source };
  }
  return subset ? { type: 'skImage', image: source, subset } : { type: 'skImage', image: source };
};

const cloneAnimations = (source: SpriteAnimationsMap | undefined): SpriteAnimationsMap => {
  if (!source) {
    return {};
  }
  const result: SpriteAnimationsMap = {};
  Object.entries(source).forEach(([name, sequence]) => {
    result[name] = Array.isArray(sequence) ? [...sequence] : [];
  });
  return result;
};

const cloneAnimationsMeta = (
  source: SpriteAnimationsMetaMap | undefined,
): SpriteAnimationsMetaMap | undefined => {
  if (!source) {
    return undefined;
  }
  const result: SpriteAnimationsMetaMap = {};
  Object.entries(source).forEach(([name, meta]) => {
    if (!meta) {
      return;
    }
    result[name] = {
      loop: meta.loop,
      fps: meta.fps,
      multipliers: Array.isArray(meta.multipliers) ? [...meta.multipliers] : undefined,
    };
  });
  return result;
};

export const buildAnimatedSpriteFrames = (
  state: SpriteEditorState,
  fallbackImage?: DataSourceParam,
  overrides?: {
    animations?: SpriteAnimationsMap;
    animationsMeta?: SpriteAnimationsMetaMap;
  },
): SpriteFramesResource | null => {
  const animations = overrides?.animations
    ? cloneAnimations(overrides.animations)
    : cloneAnimations(state.animations);
  const frames: AnimatedSpriteFrame[] = [];
  for (let i = 0; i < state.frames.length; i += 1) {
    const frame = state.frames[i]!;
    const subset =
      typeof frame.x === 'number' && typeof frame.y === 'number'
        ? {
            x: frame.x,
            y: frame.y,
            width: frame.w,
            height: frame.h,
          }
        : undefined;
    const source =
      buildFrameImageSource(frame.imageUri, subset) ?? buildFromDataSource(fallbackImage, subset);
    if (!source) {
      return null;
    }
    frames.push({
      id: frame.id,
      width: frame.w,
      height: frame.h,
      x: frame.x,
      y: frame.y,
      duration: frame.duration,
      image: source,
    });
  }
  const animationsMeta =
    overrides?.animationsMeta && Object.keys(overrides.animationsMeta).length
      ? cloneAnimationsMeta(overrides.animationsMeta)
      : cloneAnimationsMeta(state.animationsMeta as SpriteAnimationsMetaMap | undefined);
  return {
    frames,
    animations,
    animationsMeta,
    autoPlayAnimation: state.autoPlayAnimation ?? null,
    meta: state.meta,
  };
};
