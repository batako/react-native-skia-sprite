/* eslint-disable jsdoc/require-jsdoc */
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Skia,
  type SkImage,
  type Transforms3d,
} from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { AnimatedSpriteFrame } from './editor/animatedSprite2dTypes';

export interface AnimatedSprite2DViewProps {
  frame: AnimatedSpriteFrame | null;
  frameImage: SkImage | null;
  canvasSize: { width: number; height: number };
  drawOrigin: { x: number; y: number };
  flipH?: boolean;
  flipV?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedSprite2DView = memo(
  ({
    frame,
    frameImage,
    canvasSize,
    drawOrigin,
    flipH = false,
    flipV = false,
    style,
  }: AnimatedSprite2DViewProps) => {
    const transforms = useMemo<Transforms3d | undefined>(() => {
      if (!flipH && !flipV) {
        return undefined;
      }
      const transform: Transforms3d = [];
      if (flipH) {
        transform.push({ translateX: canvasSize.width }, { scaleX: -1 });
      }
      if (flipV) {
        transform.push({ translateY: canvasSize.height }, { scaleY: -1 });
      }
      return transform.length ? transform : undefined;
    }, [canvasSize.height, canvasSize.width, flipH, flipV]);

    const clipRect = useMemo(() => {
      if (!frame) {
        return null;
      }
      return Skia.XYWHRect(drawOrigin.x, drawOrigin.y, frame.width, frame.height);
    }, [drawOrigin, frame]);

    const translatedImage = useMemo(() => {
      if (!frame || !frameImage) {
        return null;
      }
      const subset = frame.image?.subset;
      if (!subset) {
        return {
          x: drawOrigin.x,
          y: drawOrigin.y,
          width: frame.width,
          height: frame.height,
        };
      }
      const widthGetter = (frameImage as SkImage & { width?: () => number }).width;
      const heightGetter = (frameImage as SkImage & { height?: () => number }).height;
      const width =
        typeof widthGetter === 'function' ? widthGetter.call(frameImage) : frame.width + subset.x;
      const height =
        typeof heightGetter === 'function'
          ? heightGetter.call(frameImage)
          : frame.height + subset.y;
      return {
        x: drawOrigin.x - subset.x,
        y: drawOrigin.y - subset.y,
        width,
        height,
      };
    }, [drawOrigin, frame, frameImage]);

    return (
      <Canvas style={[{ width: canvasSize.width, height: canvasSize.height }, style]}>
        {frame && frameImage && translatedImage && clipRect ? (
          <Group transform={transforms} clip={clipRect}>
            <SkiaImage
              image={frameImage}
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
  },
);

AnimatedSprite2DView.displayName = 'AnimatedSprite2DView';
