import {
  Canvas,
  Group,
  Skia,
  Image as SkiaImage,
  useImage,
  type DataSourceParam,
  type SkImage,
  type Transforms3d,
} from '@shopify/react-native-skia';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

/**
 * Describes a single rectangular frame within a sprite sheet.
 */
export interface SpriteFrame {
  /** X coordinate in pixels within the sprite sheet. */
  x: number;
  /** Y coordinate in pixels within the sprite sheet. */
  y: number;
  /** Width of the frame in pixels. */
  w: number;
  /** Height of the frame in pixels. */
  h: number;
  /**
   * Optional per-frame duration in milliseconds.
   * Falls back to the built-in default timing when omitted.
   */
  duration?: number;
  /** Optional absolute URI to the source image for this frame (overrides the global image prop). */
  imageUri?: string;
}

/**
 * Mapping of animation names to the sequence of frame indexes they should play.
 */
export type SpriteAnimations = Record<string, number[]>;

/**
 * Additional per-animation metadata.
 */
export interface SpriteAnimationMeta {
  /** Indicates whether the animation should loop when it reaches the end. */
  loop?: boolean;
  /** Optional FPS override for this animation (used when frame duration is not provided). */
  fps?: number;
  /** Optional per-timeline multipliers to stretch individual keyframes. */
  multipliers?: number[];
}

/**
 * Mapping of animation names to their metadata overrides.
 */
export type SpriteAnimationsMeta = Record<string, SpriteAnimationMeta>;

/**
 * Metadata payload forwarded alongside sprite frames.
 */
export interface SpriteDataMeta {
  /** Human-readable name for the sprite. */
  displayName?: string;
  /** Anchor point used by consuming applications. */
  origin?: { x: number; y: number };
  [key: string]: unknown;
}

/**
 * Payload describing the sprite sheet and the available animations.
 */
export interface SpriteData {
  /** List of rectangular frames that compose the sprite sheet. */
  frames: SpriteFrame[];
  /** Named animation definitions referencing frame indexes. */
  animations?: SpriteAnimations;
  /** Optional animation metadata overrides keyed by name. */
  animationsMeta?: SpriteAnimationsMeta;
  /** Free-form metadata attached to the sprite. */
  meta?: SpriteDataMeta;
  /** Animation that should auto-play when the sprite is loaded. */
  autoPlayAnimation?: string | null;
}

/** Allowed playback directions. */
export type SpriteAnimatorDirection = 'forward' | 'reverse';

/**
 * Options for the `play` method exposed via the imperative handle.
 */
export interface SpriteAnimatorPlayOptions {
  /** Frame index to start playback from. */
  fromFrame?: number;
  /** Local speed override that multiplies the component speedScale. */
  speedScale?: number;
  /** Direction the animation should play in. */
  direction?: SpriteAnimatorDirection;
}

/**
 * Payload describing the frame that was just rendered.
 */
export interface SpriteAnimatorFrameChangeEvent {
  /** Name of the animation currently active. */
  animationName: string | null;
  /** Frame index relative to the global frames array. */
  frameIndex: number;
  /** Cursor position within the active animation sequence. */
  frameCursor: number;
}

/**
 * Options for forcing the animation context when seeking to a frame.
 */
export interface SpriteAnimatorSetFrameOptions {
  /** Name of the animation the cursor should be relative to. */
  animationName?: string | null;
}

/**
 * Public methods exposed via the `SpriteAnimator` imperative handle.
 */
export interface SpriteAnimatorHandle {
  /** Starts or swaps an animation sequence. */
  play: (name?: string | null, opts?: SpriteAnimatorPlayOptions) => void;
  /** Stops playback and resets the cursor. */
  stop: () => void;
  /** Temporarily pauses playback without changing the cursor. */
  pause: () => void;
  /** Moves the cursor to a specific frame. */
  setFrame: (frameIndex: number, options?: SpriteAnimatorSetFrameOptions) => void;
  /** Returns whether an animation is actively playing. */
  isPlaying: () => boolean;
  /** Returns the name of the animation that is currently active. */
  getCurrentAnimation: () => string | null;
}

/**
 * Allowed image sources for the SpriteAnimator component.
 */
export type SpriteAnimatorSource = SkImage | ImageSourcePropType;

/**
 * Props accepted by the SpriteAnimator component.
 */
export interface SpriteAnimatorProps {
  /** Image or Skia surface the frames are extracted from. */
  image: SpriteAnimatorSource;
  /** Sprite sheet data describing frames and animations. */
  data: SpriteData;
  /** Optional runtime override for available animations. */
  animations?: SpriteAnimations;
  /** Optional runtime override for animation metadata like looping. */
  animationsMeta?: SpriteAnimationsMeta;
  /** Name of the animation that should run initially. */
  initialAnimation?: string;
  /** Multiplier applied to playback speed. */
  speedScale?: number;
  /** Whether frames should be mirrored horizontally. */
  flipX?: boolean;
  /** Whether frames should be mirrored vertically. */
  flipY?: boolean;
  /** Callback invoked when a non-looping animation finishes. */
  onEnd?: () => void;
  /** Callback invoked with the animation name when it finishes. */
  onAnimationEnd?: (name: string | null) => void;
  /** Callback invoked whenever the rendered frame changes. */
  onFrameChange?: (event: SpriteAnimatorFrameChangeEvent) => void;
  /** Scales the rendered sprite without modifying frame data. */
  spriteScale?: number;
  /** Style applied to the underlying Skia Canvas. */
  style?: StyleProp<ViewStyle>;
}

interface AnimationState {
  name: string | null;
  playing: boolean;
  frameCursor: number;
  speed: number;
  direction: SpriteAnimatorDirection;
}

const DEFAULT_FPS = 12;
const DEFAULT_FRAME_DURATION = 1000 / DEFAULT_FPS;
const MIN_FRAME_MULTIPLIER = 0.01;
const MIN_SPEED = 0.001;
const DEFAULT_DIRECTION: SpriteAnimatorDirection = 'forward';
const DEFAULT_LOOP_BEHAVIOR = true;

let hasWarnedSpriteAnimator = false;
const warnSpriteAnimatorDeprecation = () => {
  if (__DEV__ && !hasWarnedSpriteAnimator) {
    hasWarnedSpriteAnimator = true;
    console.warn(
      '[DEPRECATED] SpriteAnimator will be removed after v0.4.0. Please migrate to AnimatedSprite2D.',
    );
  }
};

warnSpriteAnimatorDeprecation();

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const isSkImage = (image: SpriteAnimatorSource): image is SkImage => {
  return Boolean(
    image &&
      typeof image === 'object' &&
      typeof (image as SkImage).width === 'function' &&
      typeof (image as SkImage).height === 'function',
  );
};

/**
 * Filters out invalid frame indexes from an animation sequence.
 */
const sanitizeSequence = (sequence: number[], frameCount: number) => {
  return sequence
    .map((value) => (typeof value === 'number' ? value : -1))
    .filter((index) => index >= 0 && index < frameCount);
};

/**
 * Internal component that renders the sprite sheet using Skia primitives.
 */
const SpriteAnimatorComponent = (
  {
    image,
    data,
    animations,
    animationsMeta,
    initialAnimation,
    speedScale = 1,
    flipX = false,
    flipY = false,
    spriteScale = 1,
    style,
    onEnd,
    onAnimationEnd,
    onFrameChange,
  }: SpriteAnimatorProps,
  ref: React.Ref<SpriteAnimatorHandle>,
) => {
  const frames = useMemo(() => data?.frames ?? [], [data]);
  const dataAnimations = data?.animations;
  const dataAnimationsMeta = data?.animationsMeta;
  const onEndRef = useRef<SpriteAnimatorProps['onEnd']>(undefined);
  onEndRef.current = onEnd;
  const onAnimationEndRef = useRef<SpriteAnimatorProps['onAnimationEnd']>(undefined);
  onAnimationEndRef.current = onAnimationEnd;
  const onFrameChangeRef = useRef<SpriteAnimatorProps['onFrameChange']>(undefined);
  onFrameChangeRef.current = onFrameChange;

  const animationEndRef = useRef<{ name: string | null } | null>(null);
  const onEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrameEventRef = useRef<{
    animationName: string | null;
    frameIndex: number;
  } | null>(null);

  const defaultOrder = useMemo(() => frames.map((_, index) => index), [frames]);

  const sanitizedAnimations = useMemo<SpriteAnimations>(() => {
    const source = animations ?? dataAnimations;
    if (!source) {
      return {};
    }
    const next: SpriteAnimations = {};
    Object.entries(source).forEach(([name, sequence]) => {
      if (!Array.isArray(sequence)) {
        return;
      }
      const cleaned = sanitizeSequence(sequence, frames.length);
      if (cleaned.length) {
        next[name] = cleaned;
      }
    });
    return next;
  }, [animations, dataAnimations, frames.length]);

  const mergedAnimationsMeta = useMemo<SpriteAnimationsMeta | undefined>(() => {
    return animationsMeta ?? dataAnimationsMeta ?? undefined;
  }, [animationsMeta, dataAnimationsMeta]);

  const fallbackAnimationName = useMemo(() => {
    const names = Object.keys(sanitizedAnimations);
    return names.length ? names[0] : null;
  }, [sanitizedAnimations]);

  const ensureAnimationName = useCallback(
    (candidate?: string | null) => {
      if (candidate && sanitizedAnimations[candidate]) {
        return candidate;
      }
      return fallbackAnimationName;
    },
    [fallbackAnimationName, sanitizedAnimations],
  );

  const resolveSequence = useCallback(
    (name?: string | null) => {
      if (name && sanitizedAnimations[name]) {
        return sanitizedAnimations[name]!;
      }
      return defaultOrder;
    },
    [defaultOrder, sanitizedAnimations],
  );

  const shouldLoopFor = useCallback(
    (name?: string | null) => {
      if (name && mergedAnimationsMeta && mergedAnimationsMeta[name]) {
        const metaLoop = mergedAnimationsMeta[name]?.loop;
        if (typeof metaLoop === 'boolean') {
          return metaLoop;
        }
      }
      return DEFAULT_LOOP_BEHAVIOR;
    },
    [mergedAnimationsMeta],
  );

  const normalizedSpeedScale =
    typeof speedScale === 'number' && Number.isFinite(speedScale) && speedScale > 0
      ? speedScale
      : 1;

  const initialAnimationName = ensureAnimationName(initialAnimation);
  const initialSequence = resolveSequence(initialAnimationName);
  const [animState, setAnimState] = useState<AnimationState>(() => ({
    name: initialSequence.length ? (initialAnimationName ?? null) : null,
    playing: initialSequence.length > 1,
    frameCursor: 0,
    speed: 1,
    direction: DEFAULT_DIRECTION,
  }));
  const animStateRef = useRef(animState);
  animStateRef.current = animState;

  const imageIsSkImage = isSkImage(image);
  const assetSource = imageIsSkImage ? null : (image as unknown as DataSourceParam);
  const assetImage = useImage(assetSource);
  const baseImage = imageIsSkImage ? (image as SkImage) : assetImage;
  useEffect(() => {
    setAnimState((prev) => {
      const ensuredName = ensureAnimationName(prev.name);
      const sequence = resolveSequence(ensuredName);
      if (!sequence.length) {
        const nextState: AnimationState = {
          ...prev,
          name: ensuredName ?? null,
          frameCursor: 0,
          playing: false,
        };
        return nextState;
      }
      const maxCursor = sequence.length - 1;
      const nextCursor = clamp(prev.frameCursor, 0, maxCursor);
      if (ensuredName === prev.name && nextCursor === prev.frameCursor) {
        return prev;
      }
      return {
        ...prev,
        name: ensuredName ?? null,
        frameCursor: nextCursor,
      };
    });
  }, [ensureAnimationName, resolveSequence]);

  useEffect(() => {
    if (initialAnimation === undefined) {
      return;
    }
    setAnimState((prev) => {
      if (initialAnimation === prev.name) {
        return prev;
      }
      const ensuredName = ensureAnimationName(initialAnimation);
      if (ensuredName === prev.name) {
        return prev;
      }
      const sequence = resolveSequence(ensuredName);
      if (!sequence.length) {
        return prev;
      }
      return {
        ...prev,
        name: ensuredName ?? null,
        frameCursor: 0,
      };
    });
  }, [ensureAnimationName, initialAnimation, resolveSequence]);

  const scheduleOnEndCallback = useCallback(() => {
    if (onEndTimerRef.current) {
      clearTimeout(onEndTimerRef.current);
    }
    onEndTimerRef.current = setTimeout(() => {
      onEndTimerRef.current = null;
      const payload = animationEndRef.current;
      if (payload) {
        animationEndRef.current = null;
        onAnimationEndRef.current?.(payload.name ?? null);
        onEndRef.current?.();
      }
    }, 0);
  }, []);

  const markAnimationEnded = useCallback(
    (name: string | null) => {
      animationEndRef.current = { name: name ?? null };
      scheduleOnEndCallback();
    },
    [scheduleOnEndCallback],
  );

  useEffect(() => {
    return () => {
      if (onEndTimerRef.current) {
        clearTimeout(onEndTimerRef.current);
        onEndTimerRef.current = null;
      }
    };
  }, []);

  const advanceFrame = useCallback(() => {
    setAnimState((prev) => {
      const sequence = resolveSequence(prev.name);
      if (sequence.length <= 1) {
        if (prev.playing) {
          markAnimationEnded(prev.name ?? null);
          return { ...prev, playing: false };
        }
        return prev;
      }
      const step = prev.direction === 'reverse' ? -1 : 1;
      const nextCursor = prev.frameCursor + step;
      const withinBounds = nextCursor >= 0 && nextCursor < sequence.length;
      if (withinBounds) {
        return { ...prev, frameCursor: nextCursor };
      }
      if (!shouldLoopFor(prev.name)) {
        markAnimationEnded(prev.name ?? null);
        return { ...prev, playing: false };
      }
      const wrappedCursor = prev.direction === 'reverse' ? sequence.length - 1 : 0;
      return { ...prev, frameCursor: wrappedCursor };
    });
  }, [markAnimationEnded, resolveSequence, shouldLoopFor]);

  useEffect(() => {
    if (!animState.playing) {
      return;
    }
    const sequence = resolveSequence(animState.name);
    if (sequence.length <= 1) {
      return;
    }
    const frameIndex = sequence[animState.frameCursor] ?? sequence[0];
    const frame = frames[frameIndex];
    const animationMeta = animState.name ? mergedAnimationsMeta?.[animState.name] : undefined;
    const animationFps = animationMeta?.fps;
    const baseDuration = (() => {
      if (typeof animationFps === 'number' && Number.isFinite(animationFps) && animationFps > 0) {
        return 1000 / animationFps;
      }
      if (frame?.duration) {
        return frame.duration;
      }
      return DEFAULT_FRAME_DURATION;
    })();
    const storedMultiplier = animationMeta?.multipliers?.[animState.frameCursor];
    const frameMultiplier =
      typeof storedMultiplier === 'number' && Number.isFinite(storedMultiplier)
        ? Math.max(MIN_FRAME_MULTIPLIER, storedMultiplier)
        : 1;
    const effectiveSpeed =
      Math.max(MIN_SPEED, normalizedSpeedScale) * Math.max(MIN_SPEED, animState.speed);
    const timer = setTimeout(
      () => {
        advanceFrame();
      },
      (baseDuration * frameMultiplier) / effectiveSpeed,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [
    advanceFrame,
    animState.frameCursor,
    animState.name,
    animState.playing,
    animState.speed,
    frames,
    mergedAnimationsMeta,
    normalizedSpeedScale,
    resolveSequence,
  ]);

  const play = useCallback(
    (name?: string | null, opts?: SpriteAnimatorPlayOptions) => {
      setAnimState((prev) => {
        const targetName = name === undefined ? prev.name : ensureAnimationName(name ?? null);
        const sequence = resolveSequence(targetName);
        if (!sequence.length) {
          return prev;
        }
        const requestedDirection =
          opts?.direction === 'reverse' || opts?.direction === 'forward'
            ? opts.direction
            : (prev.direction ?? DEFAULT_DIRECTION);
        const fromFrame =
          typeof opts?.fromFrame === 'number'
            ? clamp(Math.floor(opts.fromFrame), 0, sequence.length - 1)
            : targetName === prev.name && requestedDirection === prev.direction
              ? prev.frameCursor
              : requestedDirection === 'reverse'
                ? sequence.length - 1
                : 0;
        const nextSpeed =
          typeof opts?.speedScale === 'number' &&
          Number.isFinite(opts.speedScale) &&
          opts.speedScale > 0
            ? opts.speedScale
            : prev.speed;
        return {
          ...prev,
          name: targetName ?? null,
          frameCursor: fromFrame,
          playing: sequence.length > 1,
          speed: nextSpeed,
          direction: requestedDirection,
        };
      });
    },
    [ensureAnimationName, resolveSequence],
  );

  const stop = useCallback(() => {
    setAnimState((prev) => {
      if (!prev.playing && prev.frameCursor === 0) {
        return prev;
      }
      return { ...prev, playing: false, frameCursor: 0 };
    });
  }, []);

  const pause = useCallback(() => {
    setAnimState((prev) => {
      if (!prev.playing) {
        return prev;
      }
      return { ...prev, playing: false };
    });
  }, []);

  const setFrame = useCallback(
    (frameIndex: number, options?: SpriteAnimatorSetFrameOptions) => {
      setAnimState((prev) => {
        const targetName =
          options && 'animationName' in options
            ? ensureAnimationName(options.animationName ?? null)
            : prev.name;
        const sequence = resolveSequence(targetName);
        if (!sequence.length) {
          return prev;
        }
        const nextCursor = clamp(Math.floor(frameIndex), 0, sequence.length - 1);
        if (nextCursor === prev.frameCursor && targetName === prev.name) {
          return prev;
        }
        return { ...prev, name: targetName ?? null, frameCursor: nextCursor };
      });
    },
    [ensureAnimationName, resolveSequence],
  );

  useImperativeHandle(
    ref,
    () => ({
      play,
      stop,
      pause,
      setFrame,
      isPlaying: () => animStateRef.current.playing,
      getCurrentAnimation: () => animStateRef.current.name,
    }),
    [pause, play, setFrame, stop],
  );

  const activeSequence = resolveSequence(animState.name);
  const activeFrameIndex = activeSequence[animState.frameCursor] ?? activeSequence[0] ?? 0;
  const currentFrame = frames[activeFrameIndex];
  const frameImageSource = currentFrame?.imageUri ?? null;
  const frameSpecificImage = useImage(frameImageSource ?? null);
  const resolvedImage = frameSpecificImage ?? baseImage;

  useEffect(() => {
    if (!currentFrame) {
      lastFrameEventRef.current = null;
      return;
    }
    const payload: SpriteAnimatorFrameChangeEvent = {
      animationName: animState.name,
      frameIndex: activeFrameIndex,
      frameCursor: animState.frameCursor,
    };
    const prev = lastFrameEventRef.current;
    if (
      !prev ||
      prev.animationName !== payload.animationName ||
      prev.frameIndex !== payload.frameIndex
    ) {
      lastFrameEventRef.current = {
        animationName: payload.animationName,
        frameIndex: payload.frameIndex,
      };
      onFrameChangeRef.current?.(payload);
    }
  }, [activeFrameIndex, animState.frameCursor, animState.name, currentFrame]);

  const clipRect = useMemo(() => {
    if (!currentFrame) {
      return null;
    }
    return Skia.XYWHRect(0, 0, currentFrame.w * spriteScale, currentFrame.h * spriteScale);
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

const ForwardedSpriteAnimator = forwardRef<SpriteAnimatorHandle, SpriteAnimatorProps>(
  SpriteAnimatorComponent,
);

/**
 * SpriteAnimator renders a subsection of a sprite sheet inside a Skia Canvas.
 * The component is UI-agnostic and exposes a pure rendering primitive.
 */
export const SpriteAnimator = memo(ForwardedSpriteAnimator);
