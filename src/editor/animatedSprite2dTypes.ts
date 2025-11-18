/* eslint-disable jsdoc/require-jsdoc */
import type { SkImage } from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';

export interface FrameImageSubset {
  x: number;
  y: number;
  width: number;
  height: number;
}

type FrameImageSourceBase = {
  subset?: FrameImageSubset;
};

export type FrameImageSource =
  | ({ type: 'uri'; uri: string } & FrameImageSourceBase)
  | ({ type: 'require'; assetId: number } & FrameImageSourceBase)
  | ({ type: 'skImage'; image: SkImage } & FrameImageSourceBase);

export interface AnimatedSpriteFrame {
  /** Stable identifier carried over from Animation Studio. */
  id: string;
  /** Pixel width of the rendered frame. */
  width: number;
  /** Pixel height of the rendered frame. */
  height: number;
  /** Optional sprite-sheet X coordinate. */
  x?: number;
  /** Optional sprite-sheet Y coordinate. */
  y?: number;
  /** Optional duration override in milliseconds. */
  duration?: number;
  /** Per-frame offset relative to the centered canvas. */
  offset?: { x: number; y: number };
  /** Source image descriptor. */
  image: FrameImageSource;
}

export type SpriteAnimationSequence = number[];

export interface SpriteAnimationMeta {
  loop?: boolean;
  fps?: number;
  multipliers?: number[];
}

export type SpriteAnimationsMap = Record<string, SpriteAnimationSequence>;

export type SpriteAnimationsMetaMap = Record<string, SpriteAnimationMeta>;

export interface SpriteFramesResource {
  frames: AnimatedSpriteFrame[];
  animations: SpriteAnimationsMap;
  animationsMeta?: SpriteAnimationsMetaMap;
  autoPlayAnimation?: string | null;
  meta?: Record<string, unknown>;
}

export interface AnimatedSpriteFrameChangeEvent {
  animationName: string | null;
  frameIndex: number;
}

export interface AnimatedSprite2DProps {
  frames: SpriteFramesResource;
  animation?: string | null;
  autoplay?: string | null;
  playing?: boolean;
  frame?: number | null;
  speedScale?: number;
  centered?: boolean;
  flipH?: boolean;
  flipV?: boolean;
  offset?: { x: number; y: number };
  onAnimationFinished?: (name: string | null) => void;
  onFrameChanged?: (event: AnimatedSpriteFrameChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
}

export interface AnimatedSprite2DHandle {
  play: (name?: string | null) => void;
  stop: () => void;
  pause: () => void;
  seekFrame: (frameIndex: number) => void;
  getCurrentAnimation: () => string | null;
  isPlaying: () => boolean;
}
