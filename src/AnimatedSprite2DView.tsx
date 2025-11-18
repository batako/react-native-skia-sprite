/* eslint-disable jsdoc/require-jsdoc */
import {
  Canvas,
  Group,
  Image as SkiaImage,
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

    return (
      <Canvas style={[{ width: canvasSize.width, height: canvasSize.height }, style]}>
        {frame && frameImage ? (
          <Group transform={transforms}>
            <SkiaImage
              image={frameImage}
              x={drawOrigin.x}
              y={drawOrigin.y}
              width={frame.width}
              height={frame.height}
            />
          </Group>
        ) : null}
      </Canvas>
    );
  },
);

AnimatedSprite2DView.displayName = 'AnimatedSprite2DView';
