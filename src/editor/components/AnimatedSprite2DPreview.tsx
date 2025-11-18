/* eslint-disable jsdoc/require-jsdoc */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedSprite2D } from '../../AnimatedSprite2D';
import type { SpriteEditorApi } from '../hooks/useSpriteEditor';
import type { EditorIntegration } from '../hooks/useEditorIntegration';
import { buildAnimatedSpriteFrames } from '../utils/buildAnimatedSpriteFrames';
import { IconButton } from './IconButton';
import type { DataSourceParam } from '@shopify/react-native-skia';

interface AnimatedSprite2DPreviewProps {
  editor: SpriteEditorApi;
  integration: EditorIntegration;
  image: DataSourceParam;
  animationName: string | null;
}

export const AnimatedSprite2DPreview = ({
  editor,
  integration,
  image,
  animationName,
}: AnimatedSprite2DPreviewProps) => {
  const resource = useMemo(
    () =>
      buildAnimatedSpriteFrames(editor.state, image, {
        animations: integration.runtimeData.animations ?? editor.state.animations,
        animationsMeta: integration.animationsMeta,
      }),
    [editor.state, image, integration.animationsMeta, integration.runtimeData.animations],
  );
  const sceneBounds = useMemo(() => {
    if (!resource) {
      return { width: 64, height: 64 };
    }
    return resource.frames.reduce(
      (acc, frame) => ({
        width: Math.max(acc.width, frame.width),
        height: Math.max(acc.height, frame.height),
      }),
      { width: 0, height: 0 },
    );
  }, [resource]);

  const MIN_PREVIEW_HEIGHT = 420;

  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [autoZoomed, setAutoZoomed] = useState(false);
  const autoZoomDeps = useRef<{
    targetWidth: number;
    maxWidth: number | null;
    previewHeight: number;
  }>({ targetWidth: 0, maxWidth: null, previewHeight: MIN_PREVIEW_HEIGHT });

  const baseWidth = sceneBounds.width || 64;
  const baseHeight = sceneBounds.height || 64;

  const clampZoom = useCallback((value: number, maxZoom: number) => {
    const rounded = parseFloat(value.toFixed(2));
    const upper = maxZoom > 0 ? maxZoom : Number.POSITIVE_INFINITY;
    return Math.max(0.25, Math.min(rounded, upper));
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setViewportWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    }
  }, []);

  useEffect(() => {
    const deps = autoZoomDeps.current;
    const maxWidth = viewportWidth ? Math.max(200, viewportWidth - 16) : null;
    if (
      deps.targetWidth !== baseWidth ||
      deps.maxWidth !== maxWidth ||
      deps.previewHeight !== MIN_PREVIEW_HEIGHT
    ) {
      autoZoomDeps.current = {
        targetWidth: baseWidth,
        maxWidth,
        previewHeight: MIN_PREVIEW_HEIGHT,
      };
      setAutoZoomed(false);
    }
  }, [baseWidth, viewportWidth]);

  const previewHeight = MIN_PREVIEW_HEIGHT;
  const maxWidth = viewportWidth ? Math.max(200, viewportWidth - 16) : null;

  let targetWidth = baseWidth;
  let targetHeight = baseHeight;
  if (!resource) {
    targetWidth = 64;
    targetHeight = 64;
  }
  if (maxWidth && targetWidth > maxWidth) {
    const scale = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = targetHeight * scale;
  }

  const widthLimit = maxWidth ? maxWidth / (baseWidth || 1) : Number.POSITIVE_INFINITY;
  const heightLimit =
    previewHeight > 0 ? previewHeight / (baseHeight || 1) : Number.POSITIVE_INFINITY;
  const maxZoomAllowed = Math.min(widthLimit, heightLimit);

  useEffect(() => {
    if (autoZoomed) {
      return;
    }
    if (!resource) {
      return;
    }
    const safeMaxZoom = maxZoomAllowed;
    if (!Number.isFinite(safeMaxZoom) || safeMaxZoom <= 0) {
      setAutoZoomed(true);
      return;
    }
    let desiredZoom = safeMaxZoom * 0.8;
    if (safeMaxZoom >= 1) {
      desiredZoom = Math.max(1, desiredZoom);
    }
    const clamped = clampZoom(desiredZoom, safeMaxZoom);
    if (Math.abs(clamped - zoom) > 0.01) {
      setZoom(clamped);
    }
    setAutoZoomed(true);
  }, [autoZoomed, clampZoom, maxZoomAllowed, resource, zoom]);

  const adjustZoom = useCallback(
    (delta: number) => {
      setZoom((prev) => clampZoom(prev + delta, maxZoomAllowed));
    },
    [clampZoom, maxZoomAllowed],
  );

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const displayWidth = maxWidth ?? targetWidth;
  const displayHeight = previewHeight;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Animation Preview</Text>
      <View style={styles.previewCard} onLayout={handleLayout}>
        {resource ? (
          <View style={styles.zoomOverlay}>
            <View style={styles.zoomControls}>
              <IconButton
                name="zoom-out"
                onPress={() => adjustZoom(-0.25)}
                accessibilityLabel="Zoom out"
                style={styles.zoomButton}
              />
              <Pressable
                onPress={resetZoom}
                accessibilityRole="button"
                accessibilityLabel="Reset zoom to 100%"
                style={styles.zoomTextButton}
              >
                <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
              </Pressable>
              <IconButton
                name="zoom-in"
                onPress={() => adjustZoom(0.25)}
                accessibilityLabel="Zoom in"
                style={styles.zoomButton}
              />
            </View>
          </View>
        ) : null}
        {resource ? (
          <View
            style={[
              styles.canvasViewport,
              { height: displayHeight, width: '100%', maxWidth: displayWidth },
            ]}
          >
            <View style={styles.canvasInner}>
              <View
                style={{
                  width: targetWidth,
                  height: targetHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: zoom }],
                }}
              >
                <AnimatedSprite2D
                  frames={resource}
                  animation={animationName}
                  playing={false}
                  frame={integration.frameCursor}
                  speedScale={integration.speedScale}
                  centered
                />
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>
            Frame images are missing. AnimatedSprite2D preview becomes available once each frame has
            its own image URI.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    // backgroundColor: 'red',
    width: '100%',
  },
  title: {
    color: '#dfe7ff',
    fontWeight: '600',
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: '#444444',
    padding: 16,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2430',
    alignSelf: 'stretch',
    width: '100%',
  },
  canvasViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  canvasInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#9ca9c7',
    textAlign: 'center',
  },
  zoomOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    pointerEvents: 'box-none',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomButton: {
    marginRight: 4,
    marginBottom: 0,
  },
  zoomTextButton: {
    marginRight: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomLabel: {
    color: '#dfe7ff',
    fontWeight: '600',
    fontSize: 12,
    minWidth: 50,
    textAlign: 'center',
  },
});
