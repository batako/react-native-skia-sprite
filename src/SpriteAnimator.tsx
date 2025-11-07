import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ImageSourcePropType, StyleProp, ViewStyle } from "react-native";
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Skia,
  useImage,
  type DataSourceParam,
  type SkImage,
  type Transforms3d,
} from "@shopify/react-native-skia";

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Optional per-frame duration in milliseconds.
   * Falls back to the component level fps when omitted.
   */
  duration?: number;
}

export type SpriteAnimations = Record<string, number[]>;

export interface SpriteDataMeta {
  imageUri?: string;
  displayName?: string;
  origin?: { x: number; y: number };
  version?: number;
  [key: string]: unknown;
}

export interface SpriteData {
  frames: SpriteFrame[];
  animations?: SpriteAnimations;
  meta?: SpriteDataMeta;
}

export type SpriteAnimatorSource = SkImage | ImageSourcePropType;

export interface SpriteAnimatorProps {
  image: SpriteAnimatorSource;
  data: SpriteData;
  animations?: SpriteAnimations;
  fps?: number;
  loop?: boolean;
  autoplay?: boolean;
  initialAnimation?: string;
  speedScale?: number;
  flipX?: boolean;
  flipY?: boolean;
  onEnd?: () => void;
  spriteScale?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_FPS = 12;

const isSkImage = (image: SpriteAnimatorSource): image is SkImage => {
  return Boolean(
    image &&
      typeof image === "object" &&
      typeof (image as SkImage).width === "function" &&
      typeof (image as SkImage).height === "function"
  );
};

const SpriteAnimatorBase = ({
  image,
  data,
  animations,
  fps = DEFAULT_FPS,
  loop = true,
  autoplay = true,
  initialAnimation,
  speedScale = 1,
  flipX = false,
  flipY = false,
  spriteScale = 1,
  style,
  onEnd,
}: SpriteAnimatorProps) => {
  const frames = data?.frames ?? [];
  const dataAnimations = data?.animations;
  const [frameCursor, setFrameCursor] = useState(0);
  const onEndRef = useRef<SpriteAnimatorProps["onEnd"]>(undefined);
  onEndRef.current = onEnd;

  const imageIsSkImage = isSkImage(image);
  const assetImage = imageIsSkImage
    ? null
    : useImage((image as unknown) as DataSourceParam);
  const resolvedImage = imageIsSkImage ? image : assetImage;
  const stableFps = Math.max(1, fps);
  const speedMultiplier =
    typeof speedScale === "number" && Number.isFinite(speedScale) && speedScale > 0
      ? speedScale
      : 1;

  const defaultOrder = useMemo(
    () => frames.map((_, index) => index),
    [frames]
  );

  const playbackOrder = useMemo(() => {
    const map = animations ?? dataAnimations;
    if (!frames.length || !map) {
      return defaultOrder;
    }
    const availableNames = Object.keys(map);
    if (!availableNames.length) {
      return defaultOrder;
    }
    const resolvedName =
      initialAnimation && Array.isArray(map[initialAnimation]) && map[initialAnimation]?.length
        ? initialAnimation
        : availableNames.find(
            (name) => Array.isArray(map[name]) && (map[name]?.length ?? 0) > 0
          );
    if (!resolvedName) {
      return defaultOrder;
    }
    const rawSequence = map[resolvedName] ?? [];
    const sanitized = rawSequence
      .map((value) => (typeof value === "number" ? value : -1))
      .filter((index) => index >= 0 && index < frames.length);
    return sanitized.length ? sanitized : defaultOrder;
  }, [animations, dataAnimations, defaultOrder, frames.length, initialAnimation]);

  useEffect(() => {
    setFrameCursor(0);
  }, [playbackOrder]);

  useEffect(() => {
    const sequenceLength = playbackOrder.length;
    if (!autoplay || sequenceLength <= 1) {
      return;
    }
    let cursor = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const durationFor = (index: number) => {
      const frameIndex = playbackOrder[index] ?? index;
      const frame = frames[frameIndex];
      const baseDuration = frame?.duration ?? 1000 / stableFps;
      return baseDuration / speedMultiplier;
    };
    const queueNext = () => {
      timer = setTimeout(() => {
        const nextIndex = cursor + 1;
        if (nextIndex >= sequenceLength) {
          if (!loop) {
            onEndRef.current?.();
            return;
          }
          cursor = 0;
        } else {
          cursor = nextIndex;
        }
        setFrameCursor(cursor);
        queueNext();
      }, durationFor(cursor));
    };
    queueNext();
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [autoplay, frames, loop, playbackOrder, speedMultiplier, stableFps]);

  const currentFrame =
    frames[
      playbackOrder[frameCursor] ??
        defaultOrder[frameCursor] ??
        frameCursor
    ];

  const clipRect = useMemo(() => {
    if (!currentFrame) {
      return null;
    }
    return Skia.XYWHRect(
      0,
      0,
      currentFrame.w * spriteScale,
      currentFrame.h * spriteScale
    );
  }, [currentFrame, spriteScale]);

  const translatedImage = useMemo(() => {
    if (!resolvedImage || !currentFrame) {
      return null;
    }
    return {
      width: resolvedImage.width() * spriteScale,
      height: resolvedImage.height() * spriteScale,
      x: -currentFrame.x * spriteScale,
      y: -currentFrame.y * spriteScale,
    };
  }, [currentFrame, resolvedImage, spriteScale]);

  const flipTransform = useMemo<Transforms3d | undefined>(() => {
    if (!currentFrame) {
      return undefined;
    }
    const transforms: Transforms3d = [];
    if (flipX) {
      transforms.push({ translateX: currentFrame.w * spriteScale });
      transforms.push({ scaleX: -1 });
    }
    if (flipY) {
      transforms.push({ translateY: currentFrame.h * spriteScale });
      transforms.push({ scaleY: -1 });
    }
    return transforms.length ? transforms : undefined;
  }, [currentFrame, flipX, flipY, spriteScale]);

  return (
    <Canvas style={style}>
      {resolvedImage && currentFrame && clipRect && translatedImage ? (
        <Group clip={clipRect}>
          <Group transform={flipTransform}>
            <SkiaImage
              image={resolvedImage}
              x={translatedImage.x}
              y={translatedImage.y}
              width={translatedImage.width}
              height={translatedImage.height}
              fit="none"
            />
          </Group>
        </Group>
      ) : null}
    </Canvas>
  );
};

/**
 * SpriteAnimator renders a subsection of a sprite sheet inside a Skia Canvas.
 * The component is UI-agnostic and exposes a pure rendering primitive.
 */
export const SpriteAnimator = memo(SpriteAnimatorBase);
