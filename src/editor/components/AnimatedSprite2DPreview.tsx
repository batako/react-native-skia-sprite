/* eslint-disable jsdoc/require-jsdoc */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { AnimatedSprite2D } from '../../AnimatedSprite2D';
import type { SpriteEditorApi } from '../hooks/useSpriteEditor';
import type { EditorIntegration } from '../hooks/useEditorIntegration';
import { buildAnimatedSpriteFrames } from '../utils/buildAnimatedSpriteFrames';
import { IconButton } from './IconButton';
import type { DataSourceParam } from '@shopify/react-native-skia';
import type { SpriteFramesResource } from '../animatedSprite2dTypes';
import { useSpriteAnimationTicker } from '../../hooks/useSpriteAnimationTicker';
import { getEditorStrings } from '../localization';

const MIN_PREVIEW_HEIGHT = 420;
const MIN_ZOOM = 0.05;
const MIN_VIEWPORT_HEIGHT = 260;
const VERTICAL_RESERVE = 320;

interface AnimatedSprite2DPreviewProps {
  editor: SpriteEditorApi;
  integration: EditorIntegration;
  image: DataSourceParam;
  animationName: string | null;
  mode?: 'timeline' | 'self';
  allowRendering?: boolean;
}

export const AnimatedSprite2DPreview = ({
  editor,
  integration,
  image,
  animationName,
  mode = 'timeline',
  allowRendering = true,
}: AnimatedSprite2DPreviewProps) => {
  const strings = useMemo(() => getEditorStrings(), []);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme !== 'light';
  const styles = useMemo(() => createThemedStyles(isDarkMode), [isDarkMode]);
  const rawResource = useMemo(
    () =>
      buildAnimatedSpriteFrames(editor.state, image, {
        animations: integration.runtimeData.animations ?? editor.state.animations,
        animationsMeta: integration.animationsMeta,
      }),
    [editor.state, image, integration.animationsMeta, integration.runtimeData.animations],
  );
  const resource = allowRendering ? rawResource : null;
  const resolvedResource: SpriteFramesResource = useMemo(() => {
    if (resource) {
      return resource;
    }
    return { frames: [], animations: {}, animationsMeta: {}, autoPlayAnimation: null, meta: {} };
  }, [resource]);

  const sceneBounds = useMemo(() => {
    if (!resolvedResource.frames.length) {
      return { width: 64, height: 64 };
    }
    return resolvedResource.frames.reduce(
      (acc, frame) => ({
        width: Math.max(acc.width, frame.width),
        height: Math.max(acc.height, frame.height),
      }),
      { width: 0, height: 0 },
    );
  }, [resolvedResource.frames]);

  const windowSize = useWindowDimensions();
  const previewHeight = useMemo(() => {
    const availableHeight = Math.max(MIN_VIEWPORT_HEIGHT, windowSize.height - VERTICAL_RESERVE);
    return Math.min(MIN_PREVIEW_HEIGHT, availableHeight);
  }, [windowSize.height]);

  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [autoZoomed, setAutoZoomed] = useState(false);
  const autoZoomDeps = useRef<{
    targetWidth: number;
    maxWidth: number | null;
    previewHeight: number;
  }>({ targetWidth: 0, maxWidth: null, previewHeight });

  const baseWidth = sceneBounds.width || 64;
  const baseHeight = sceneBounds.height || 64;

  const clampZoom = useCallback((value: number, maxZoom: number) => {
    const rounded = parseFloat(value.toFixed(2));
    const upper = maxZoom > 0 ? maxZoom : Number.POSITIVE_INFINITY;
    return Math.max(MIN_ZOOM, Math.min(rounded, upper));
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
      deps.previewHeight !== previewHeight
    ) {
      autoZoomDeps.current = {
        targetWidth: baseWidth,
        maxWidth,
        previewHeight,
      };
      setAutoZoomed(false);
    }
  }, [baseWidth, previewHeight, viewportWidth]);
  const maxWidth = viewportWidth ? Math.max(200, viewportWidth - 16) : null;

  let targetWidth = baseWidth;
  let targetHeight = baseHeight;
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
    setZoom(() => clampZoom(1, maxZoomAllowed));
  }, [clampZoom, maxZoomAllowed]);

  const displayWidth = maxWidth ?? targetWidth;
  const displayHeight = previewHeight;
  const isSelfDriven = mode === 'self';

  const {
    animationName: selfAnimationName,
    setAnimationName: setSelfAnimationName,
    playing: selfPlaying,
    setPlaying: setSelfPlaying,
    play: selfPlay,
    pause: selfPause,
    stop: selfStop,
  } = useSpriteAnimationTicker({
    frames: resolvedResource,
    initialAnimation: animationName,
    initialPlaying: isSelfDriven,
    speedScale: integration.speedScale,
  });

  useEffect(() => {
    if (mode === 'self') {
      setSelfAnimationName(animationName);
    }
  }, [animationName, mode, setSelfAnimationName]);

  useEffect(() => {
    if (mode !== 'self') {
      setSelfPlaying(false);
    }
  }, [mode, setSelfPlaying]);

  const handleSelfToggle = useCallback(() => {
    if (selfPlaying) {
      selfPause();
    } else {
      selfPlay(animationName);
    }
  }, [animationName, selfPause, selfPlay, selfPlaying]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.animationStudio.animationPreviewTitle}</Text>
      <View style={styles.previewCard} onLayout={handleLayout}>
        {resource ? (
          <View style={styles.zoomOverlay}>
            <View style={styles.zoomControls}>
              <IconButton
                name="zoom-out"
                onPress={() => adjustZoom(-0.25)}
                accessibilityLabel={strings.general.zoomOut}
                style={styles.zoomButton}
                color="#fff"
              />
              <Pressable
                onPress={resetZoom}
                accessibilityRole="button"
                accessibilityLabel={strings.general.resetZoom}
                style={styles.zoomTextButton}
              >
                <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
              </Pressable>
              <IconButton
                name="zoom-in"
                onPress={() => adjustZoom(0.25)}
                accessibilityLabel={strings.general.zoomIn}
                style={styles.zoomButton}
                color="#fff"
              />
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.canvasViewport,
            { height: displayHeight, width: '100%', maxWidth: displayWidth },
          ]}
        >
          {resource ? (
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
                  frames={resolvedResource}
                  animation={isSelfDriven ? selfAnimationName : animationName}
                  playing={isSelfDriven ? selfPlaying : false}
                  frame={isSelfDriven ? undefined : integration.frameCursor}
                  speedScale={integration.speedScale}
                  centered
                />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>{strings.preview.framesMissing}</Text>
            </View>
          )}
        </View>
        {isSelfDriven ? (
          <View style={styles.playbackControls}>
            <IconButton
              name={selfPlaying ? 'pause' : 'play-arrow'}
              onPress={handleSelfToggle}
              accessibilityLabel={
                selfPlaying ? strings.preview.pausePreview : strings.preview.playPreview
              }
              style={styles.zoomButton}
              color="#fff"
            />
            <IconButton
              name="stop"
              onPress={selfStop}
              accessibilityLabel={strings.preview.stopPreview}
              style={styles.zoomButton}
              color="#fff"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const baseStyles = {
  container: {
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
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#1f2430',
    alignSelf: 'stretch',
    width: '100%',
  },
  canvasViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#444444',
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
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    minWidth: 50,
    textAlign: 'center',
  },
  playbackControls: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
  },
} as const;

const COLOR_KEYS = new Set([
  'backgroundColor',
  'borderColor',
  'borderBottomColor',
  'borderTopColor',
  'borderLeftColor',
  'borderRightColor',
  'color',
]);

const lightColorMap: Record<string, string> = {
  '#dfe7ff': '#0f172a',
  '#444444': '#eef2f9',
  '#1f2430': '#d1d7e4',
  '#9ca9c7': '#475569',
};

const lightTextColorMap: Record<string, string> = {
  '#dfe7ff': '#0f172a',
};

const mapStyleColors = (
  stylesObject: Record<string, any>,
  mapColor: (value: string, key: string) => string,
): Record<string, any> => {
  const next: Record<string, any> = {};
  Object.entries(stylesObject).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = mapStyleColors(value, mapColor);
      return;
    }
    if (typeof value === 'string' && COLOR_KEYS.has(key)) {
      next[key] = mapColor(value, key);
      return;
    }
    next[key] = value;
  });
  return next;
};

const createThemedStyles = (isDarkMode: boolean) => {
  const mapColor = (value: string, key: string) => {
    if (!isDarkMode && key === 'color' && value === '#dfe7ff') {
      return '#0f172a';
    }
    return value;
  };
  return StyleSheet.create(mapStyleColors(baseStyles, mapColor));
};
