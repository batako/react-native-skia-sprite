import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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

export interface SpriteAnimationMeta {
  loop?: boolean;
}

export type SpriteAnimationsMeta = Record<string, SpriteAnimationMeta>;

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
  animationsMeta?: SpriteAnimationsMeta;
  meta?: SpriteDataMeta;
}

export interface SpriteAnimatorPlayOptions {
  fromFrame?: number;
  speedScale?: number;
}

export interface SpriteAnimatorHandle {
  play: (name?: string | null, opts?: SpriteAnimatorPlayOptions) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setFrame: (frameIndex: number) => void;
  isPlaying: () => boolean;
  getCurrentAnimation: () => string | null;
}

export type SpriteAnimatorSource = SkImage | ImageSourcePropType;

export interface SpriteAnimatorProps {
  image: SpriteAnimatorSource;
  data: SpriteData;
  animations?: SpriteAnimations;
  animationsMeta?: SpriteAnimationsMeta;
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

interface AnimationState {
  name: string | null;
  playing: boolean;
  frameCursor: number;
  speed: number;
}

const DEFAULT_FPS = 12;
const MIN_SPEED = 0.001;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const isSkImage = (image: SpriteAnimatorSource): image is SkImage => {
  return Boolean(
    image &&
      typeof image === "object" &&
      typeof (image as SkImage).width === "function" &&
      typeof (image as SkImage).height === "function"
  );
};

const sanitizeSequence = (sequence: number[], frameCount: number) => {
  return sequence
    .map((value) => (typeof value === "number" ? value : -1))
    .filter((index) => index >= 0 && index < frameCount);
};

const SpriteAnimatorComponent = (
  {
    image,
    data,
    animations,
    animationsMeta,
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
  }: SpriteAnimatorProps,
  ref: React.Ref<SpriteAnimatorHandle>
) => {
  const frames = data?.frames ?? [];
  const dataAnimations = data?.animations;
  const dataAnimationsMeta = data?.animationsMeta;
  const onEndRef = useRef<SpriteAnimatorProps["onEnd"]>(undefined);
  onEndRef.current = onEnd;

  const animationEndRef = useRef<{ name: string | null } | null>(null);
  const onEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    [fallbackAnimationName, sanitizedAnimations]
  );

  const resolveSequence = useCallback(
    (name?: string | null) => {
      if (name && sanitizedAnimations[name]) {
        return sanitizedAnimations[name]!;
      }
      return defaultOrder;
    },
    [defaultOrder, sanitizedAnimations]
  );

  const shouldLoopFor = useCallback(
    (name?: string | null) => {
      if (name && mergedAnimationsMeta && mergedAnimationsMeta[name]) {
        const metaLoop = mergedAnimationsMeta[name]?.loop;
        if (typeof metaLoop === "boolean") {
          return metaLoop;
        }
      }
      return loop;
    },
    [loop, mergedAnimationsMeta]
  );

  const normalizedSpeedScale =
    typeof speedScale === "number" && Number.isFinite(speedScale) && speedScale > 0
      ? speedScale
      : 1;

  const initialAnimationName = ensureAnimationName(initialAnimation);
  const initialSequence = resolveSequence(initialAnimationName);
  const [animState, setAnimState] = useState<AnimationState>(() => ({
    name: initialSequence.length ? initialAnimationName ?? null : null,
    playing: autoplay && initialSequence.length > 1,
    frameCursor: 0,
    speed: 1,
  }));
  const animStateRef = useRef(animState);
  animStateRef.current = animState;

  const imageIsSkImage = isSkImage(image);
  const assetImage = imageIsSkImage ? null : useImage((image as unknown) as DataSourceParam);
  const resolvedImage = imageIsSkImage ? image : assetImage;
  const stableFps = Math.max(1, fps);

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

  useEffect(() => {
    if (autoplay) {
      setAnimState((prev) => {
        if (prev.playing) {
          return prev;
        }
        const sequence = resolveSequence(prev.name);
        if (sequence.length <= 1) {
          return prev;
        }
        return { ...prev, playing: true };
      });
      return;
    }
    setAnimState((prev) => {
      if (!prev.playing) {
        return prev;
      }
      return { ...prev, playing: false };
    });
  }, [autoplay, resolveSequence]);

  const scheduleOnEndCallback = useCallback(() => {
    if (onEndTimerRef.current) {
      clearTimeout(onEndTimerRef.current);
    }
    onEndTimerRef.current = setTimeout(() => {
      onEndTimerRef.current = null;
      if (animationEndRef.current) {
        onEndRef.current?.();
        animationEndRef.current = null;
      }
    }, 0);
  }, []);

  const markAnimationEnded = useCallback(
    (name: string | null) => {
      animationEndRef.current = { name: name ?? null };
      scheduleOnEndCallback();
    },
    [scheduleOnEndCallback]
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
      const nextCursor = prev.frameCursor + 1;
      if (nextCursor < sequence.length) {
        return { ...prev, frameCursor: nextCursor };
      }
        if (!shouldLoopFor(prev.name)) {
          markAnimationEnded(prev.name ?? null);
          return { ...prev, playing: false };
        }
      return { ...prev, frameCursor: 0 };
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
    const baseDuration = frame?.duration ?? 1000 / stableFps;
    const effectiveSpeed =
      Math.max(MIN_SPEED, normalizedSpeedScale) * Math.max(MIN_SPEED, animState.speed);
    const timer = setTimeout(() => {
      advanceFrame();
    }, baseDuration / effectiveSpeed);
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
    normalizedSpeedScale,
    resolveSequence,
    stableFps,
  ]);

  const play = useCallback(
    (name?: string | null, opts?: SpriteAnimatorPlayOptions) => {
      setAnimState((prev) => {
        const targetName =
          name === undefined ? prev.name : ensureAnimationName(name ?? null);
        const sequence = resolveSequence(targetName);
        if (!sequence.length) {
          return prev;
        }
        const fromFrame =
          typeof opts?.fromFrame === "number"
            ? clamp(Math.floor(opts.fromFrame), 0, sequence.length - 1)
            : targetName === prev.name
            ? prev.frameCursor
            : 0;
        const nextSpeed =
          typeof opts?.speedScale === "number" &&
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
        };
      });
    },
    [ensureAnimationName, resolveSequence]
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

  const resume = useCallback(() => {
    setAnimState((prev) => {
      if (prev.playing) {
        return prev;
      }
      const sequence = resolveSequence(prev.name);
      if (sequence.length <= 1) {
        return prev;
      }
      return { ...prev, playing: true };
    });
  }, [resolveSequence]);

  const setFrame = useCallback(
    (frameIndex: number) => {
      setAnimState((prev) => {
        const sequence = resolveSequence(prev.name);
        if (!sequence.length) {
          return prev;
        }
        const nextCursor = clamp(Math.floor(frameIndex), 0, sequence.length - 1);
        if (nextCursor === prev.frameCursor) {
          return prev;
        }
        return { ...prev, frameCursor: nextCursor };
      });
    },
    [resolveSequence]
  );

  useImperativeHandle(
    ref,
    () => ({
      play,
      stop,
      pause,
      resume,
      setFrame,
      isPlaying: () => animStateRef.current.playing,
      getCurrentAnimation: () => animStateRef.current.name,
    }),
    [pause, play, resume, setFrame, stop]
  );

  const activeSequence = resolveSequence(animState.name);
  const activeFrameIndex =
    activeSequence[animState.frameCursor] ?? activeSequence[0] ?? 0;
  const currentFrame = frames[activeFrameIndex];

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

const ForwardedSpriteAnimator = forwardRef<SpriteAnimatorHandle, SpriteAnimatorProps>(
  SpriteAnimatorComponent
);

/**
 * SpriteAnimator renders a subsection of a sprite sheet inside a Skia Canvas.
 * The component is UI-agnostic and exposes a pure rendering primitive.
 */
export const SpriteAnimator = memo(ForwardedSpriteAnimator);
