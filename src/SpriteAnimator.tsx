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

export interface SpriteData {
  frames: SpriteFrame[];
  meta?: Record<string, unknown>;
}

export type SpriteAnimatorSource = SkImage | ImageSourcePropType;

export interface SpriteAnimatorProps {
  image: SpriteAnimatorSource;
  data: SpriteData;
  fps?: number;
  loop?: boolean;
  autoplay?: boolean;
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
  fps = DEFAULT_FPS,
  loop = true,
  autoplay = true,
  spriteScale = 1,
  style,
  onEnd,
}: SpriteAnimatorProps) => {
  const frames = data?.frames ?? [];
  const [frameIndex, setFrameIndex] = useState(0);
  const onEndRef = useRef<SpriteAnimatorProps["onEnd"]>(undefined);
  onEndRef.current = onEnd;

  const imageIsSkImage = isSkImage(image);
  const assetImage = imageIsSkImage
    ? null
    : useImage((image as unknown) as DataSourceParam);
  const resolvedImage = imageIsSkImage ? image : assetImage;
  const stableFps = Math.max(1, fps);

  useEffect(() => {
    setFrameIndex(0);
  }, [frames.length]);

  useEffect(() => {
    if (!autoplay || frames.length <= 1) {
      return;
    }
    let cursor = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const durationFor = (index: number) => {
      const frame = frames[index];
      return frame?.duration ?? 1000 / stableFps;
    };
    const queueNext = () => {
      timer = setTimeout(() => {
        const nextIndex = cursor + 1;
        if (nextIndex >= frames.length) {
          if (!loop) {
            onEndRef.current?.();
            return;
          }
          cursor = 0;
        } else {
          cursor = nextIndex;
        }
        setFrameIndex(cursor);
        queueNext();
      }, durationFor(cursor));
    };
    queueNext();
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [autoplay, frames, loop, stableFps]);

  const currentFrame = frames[frameIndex];

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

  return (
    <Canvas style={style}>
      {resolvedImage && currentFrame && clipRect && translatedImage ? (
        <Group clip={clipRect}>
          <SkiaImage
            image={resolvedImage}
            x={translatedImage.x}
            y={translatedImage.y}
            width={translatedImage.width}
            height={translatedImage.height}
            fit="none"
          />
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
