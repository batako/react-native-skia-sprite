import { Canvas, Image, Path, Rect, Skia, useImage } from '@shopify/react-native-skia';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import type { SpriteEditorApi } from 'react-native-skia-sprite-animator';
import { mergeFrames, pointInFrame, snapToGrid } from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';

export interface SpriteCanvasViewProps {
  editor: SpriteEditorApi;
  image: DataSourceParam;
  gridSize?: number;
}

const MIN_SIZE = 256;

export const SpriteCanvasView = ({ editor, image, gridSize = 16 }: SpriteCanvasViewProps) => {
  const frames = editor.state.frames;
  const selectedIds = editor.state.selected;
  const skiaImage = useImage(image);
  const canvasWidth = Math.max(skiaImage?.width() ?? MIN_SIZE, MIN_SIZE);
  const canvasHeight = Math.max(skiaImage?.height() ?? MIN_SIZE, MIN_SIZE);

  const gridLines = useMemo(() => {
    if (!gridSize) {
      return { vertical: [], horizontal: [] };
    }
    const vertical: number[] = [];
    const horizontal: number[] = [];
    for (let x = snapToGrid(0, gridSize); x <= canvasWidth; x += gridSize) {
      vertical.push(x);
    }
    for (let y = snapToGrid(0, gridSize); y <= canvasHeight; y += gridSize) {
      horizontal.push(y);
    }
    return { vertical, horizontal };
  }, [canvasHeight, canvasWidth, gridSize]);

  const selectedFrames = useMemo(
    () => frames.filter((frame) => selectedIds.includes(frame.id)),
    [frames, selectedIds],
  );
  const selectionBounds = useMemo(() => mergeFrames(selectedFrames), [selectedFrames]);
  const selectionPath = useMemo(() => {
    if (!selectionBounds) {
      return null;
    }
    const path = Skia.Path.Make();
    path.addRect({
      x: selectionBounds.x,
      y: selectionBounds.y,
      width: selectionBounds.w,
      height: selectionBounds.h,
    });
    return path;
  }, [selectionBounds]);

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const frame = [...frames].reverse().find((item) => pointInFrame(point, item));
      if (!frame) {
        editor.clearSelection();
        return;
      }
      editor.selectFrame(frame.id, { toggle: true });
    },
    [editor, frames],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: handleTap,
      }),
    [handleTap],
  );

  return (
    <View style={styles.container}>
      {!skiaImage && (
        <View style={styles.loader}>
          <ActivityIndicator />
          <Text style={styles.loaderText}>Loading sprite sheet…</Text>
        </View>
      )}
      <View style={{ width: canvasWidth, height: canvasHeight }}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          {skiaImage && (
            <Image
              image={skiaImage}
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fit="contain"
            />
          )}
          {gridLines.vertical.map((x) => (
            <Rect
              key={`v-${x}`}
              x={x}
              y={0}
              width={1}
              height={canvasHeight}
              color="rgba(255,255,255,0.15)"
            />
          ))}
          {gridLines.horizontal.map((y) => (
            <Rect
              key={`h-${y}`}
              x={0}
              y={y}
              width={canvasWidth}
              height={1}
              color="rgba(255,255,255,0.15)"
            />
          ))}
          {frames.map((frame) => (
            <Rect
              key={frame.id}
              x={frame.x}
              y={frame.y}
              width={frame.w}
              height={frame.h}
              color={
                selectedIds.includes(frame.id) ? 'rgba(80,141,255,0.25)' : 'rgba(255,255,255,0.08)'
              }
            />
          ))}
          {selectionPath && (
            <Path
              path={selectionPath}
              color="rgba(80,141,255,0.9)"
              style="stroke"
              strokeWidth={2}
            />
          )}
        </Canvas>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only" {...responder.panHandlers} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111315',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f242e',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 8,
    color: '#a9b1c0',
    fontSize: 12,
  },
});
