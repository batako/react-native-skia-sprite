import React from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { SpriteAnimator } from '../../SpriteAnimator';
import type { SpriteAnimatorSource } from '../../SpriteAnimator';
import type { DataSourceParam, SkImage } from '@shopify/react-native-skia';
import type { EditorIntegration } from '../hooks/useEditorIntegration';
import { IconButton } from './IconButton';

export interface PreviewPlayerProps {
  integration: EditorIntegration;
  image: DataSourceParam;
  title?: string;
  width?: number;
  height?: number;
}

export const PreviewPlayer = ({
  integration,
  image,
  title = 'Animation Preview',
  width,
  height,
}: PreviewPlayerProps) => {
  const {
    animatorRef,
    runtimeData,
    animationsMeta,
    speedScale,
    onFrameChange,
    onAnimationEnd,
    activeAnimation,
  } = integration;
  const animatorImageSource = image as SpriteAnimatorSource;
  const { width: imageWidth, height: imageHeight } = useImageDimensions(image);
  const [viewportWidth, setViewportWidth] = React.useState<number | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [autoZoomed, setAutoZoomed] = React.useState(false);
  const autoZoomDepsRef = React.useRef<{
    height?: number;
    targetWidth: number;
    maxWidth: number | null;
    previewHeight: number;
  }>({
    height,
    targetWidth: 0,
    maxWidth: null,
    previewHeight: 0,
  });
  const frameBounds = React.useMemo(() => {
    const frames = runtimeData.frames ?? [];
    if (!frames.length) {
      return { width: imageWidth ?? 64, height: imageHeight ?? 64 };
    }
    return frames.reduce(
      (acc, frame) => ({
        width: Math.max(acc.width, frame.w),
        height: Math.max(acc.height, frame.h),
      }),
      { width: 1, height: 1 },
    );
  }, [runtimeData.frames, imageWidth, imageHeight]);

  const MIN_PREVIEW_HEIGHT = 420;
  const baseWidth = frameBounds.width || 64;
  const baseHeight = frameBounds.height || 64;
  const maxWidth = viewportWidth ? Math.max(200, viewportWidth - 16) : null;
  const activeSequenceLength =
    activeAnimation && runtimeData.animations
      ? (runtimeData.animations[activeAnimation]?.length ?? 0)
      : null;
  const hasFramesToRender = activeAnimation
    ? (activeSequenceLength ?? 0) > 0
    : (runtimeData.frames?.length ?? 0) > 0;

  let targetWidth = width ?? baseWidth;
  let targetHeight = height ?? baseHeight;
  if (!height && maxWidth && targetWidth > maxWidth) {
    const scale = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = targetHeight * scale;
  }
  const previewHeight = height ?? MIN_PREVIEW_HEIGHT;
  const widthLimit = maxWidth ? maxWidth / targetWidth : Number.POSITIVE_INFINITY;
  const heightLimit = previewHeight > 0 ? previewHeight / targetHeight : Number.POSITIVE_INFINITY;
  const maxZoomAllowed =
    height || !Number.isFinite(Math.min(widthLimit, heightLimit))
      ? Number.POSITIVE_INFINITY
      : Math.min(widthLimit, heightLimit);
  const zoomedWidth = targetWidth * zoom;
  const zoomedHeight = targetHeight * zoom;
  const displayHeight = previewHeight;

  const clampZoom = React.useCallback(
    (value: number) => {
      const rounded = parseFloat(value.toFixed(2));
      const upperBound = maxZoomAllowed > 0 ? maxZoomAllowed : Number.POSITIVE_INFINITY;
      return Math.max(0.25, Math.min(rounded, upperBound));
    },
    [maxZoomAllowed],
  );

  const adjustZoom = (delta: number) => {
    setZoom((prev) => clampZoom(prev + delta));
  };

  const resetZoom = () => setZoom(1);

  React.useEffect(() => {
    if (height || targetWidth <= 0 || autoZoomed) {
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
    desiredZoom = clampZoom(desiredZoom);
    if (Math.abs(desiredZoom - zoom) > 0.01) {
      setZoom(desiredZoom);
    }
    setAutoZoomed(true);
  }, [
    autoZoomed,
    clampZoom,
    height,
    maxWidth,
    maxZoomAllowed,
    previewHeight,
    targetHeight,
    targetWidth,
    zoom,
  ]);

  React.useEffect(() => {
    const prev = autoZoomDepsRef.current;
    if (
      prev.height !== height ||
      prev.targetWidth !== targetWidth ||
      prev.maxWidth !== maxWidth ||
      prev.previewHeight !== previewHeight
    ) {
      autoZoomDepsRef.current = { height, targetWidth, maxWidth, previewHeight };
      setAutoZoomed(false);
    }
  }, [height, targetWidth, maxWidth, previewHeight]);

  const showTitle = Boolean(title);

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.title}>{title}</Text>}
      <View
        style={styles.canvasCard}
        onLayout={(event: LayoutChangeEvent) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0) {
            setViewportWidth((prev) => (prev === nextWidth ? prev : nextWidth));
          }
        }}
      >
        <View pointerEvents="box-none" style={styles.zoomOverlay}>
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
        <View style={styles.canvasFrame}>
          <View style={[styles.canvasInner, { height: displayHeight }]}>
            <View style={[styles.canvasViewport, { width: zoomedWidth, height: zoomedHeight }]}>
              <View
                style={{ width: targetWidth, height: targetHeight, transform: [{ scale: zoom }] }}
              >
                {hasFramesToRender ? (
                  <SpriteAnimator
                    ref={animatorRef}
                    image={animatorImageSource}
                    data={runtimeData}
                    animationsMeta={animationsMeta}
                    speedScale={speedScale}
                    onFrameChange={onFrameChange}
                    onAnimationEnd={onAnimationEnd}
                    style={[styles.canvas, { width: targetWidth, height: targetHeight }]}
                  />
                ) : (
                  <View style={{ width: targetWidth, height: targetHeight }} />
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    color: '#dfe7ff',
    fontWeight: '600',
    marginBottom: 8,
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
  },
  zoomLabel: {
    color: '#dfe7ff',
    fontWeight: '600',
    fontSize: 12,
    minWidth: 50,
    textAlign: 'center',
  },
  canvasCard: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasFrame: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 420,
  },
  canvasInner: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 420,
    width: '100%',
    backgroundColor: '#444444',
    padding: 8,
  },
  canvasViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    alignSelf: 'center',
  },
  canvas: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
});

const useImageDimensions = (source: DataSourceParam) => {
  const [size, setSize] = React.useState<{ width?: number; height?: number }>({});

  React.useEffect(() => {
    if (isSkiaImage(source)) {
      setSize({ width: source.width(), height: source.height() });
      return;
    }
    if (typeof source === 'number') {
      const resolved = Image.resolveAssetSource(source);
      if (resolved?.width && resolved?.height) {
        setSize({ width: resolved.width, height: resolved.height });
      } else {
        setSize({});
      }
      return;
    }
    const uri = typeof source === 'string' ? source : (source as { uri?: string }).uri;
    if (!uri) {
      setSize({});
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) {
          setSize({ width, height });
        }
      },
      () => {
        if (!cancelled) {
          setSize({});
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  return size;
};

const isSkiaImage = (value: unknown): value is SkImage => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as SkImage).width === 'function' &&
      typeof (value as SkImage).height === 'function',
  );
};
