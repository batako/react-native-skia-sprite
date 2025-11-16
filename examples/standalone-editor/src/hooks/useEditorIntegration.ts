import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SpriteAnimatorDirection,
  SpriteAnimatorFrameChangeEvent,
  SpriteAnimatorHandle,
  SpriteData,
  SpriteEditorApi,
} from 'react-native-skia-sprite-animator';

export interface UseEditorIntegrationOptions {
  editor: SpriteEditorApi;
}

interface SeekFrameOptions {
  cursor?: number;
  animationName?: string | null;
  sequenceOverride?: number[] | null;
}

interface PlayOptions {
  fromFrame?: number;
  direction?: SpriteAnimatorDirection;
}

export const useEditorIntegration = ({ editor }: UseEditorIntegrationOptions) => {
  const animatorRef = useRef<SpriteAnimatorHandle>(null);
  const [speedScale, setSpeedScale] = useState(1);
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameCursor, setFrameCursor] = useState(0);
  const [timelineCursor, setTimelineCursor] = useState<number | null>(null);
  const [playDirection, setPlayDirection] = useState<SpriteAnimatorDirection>('forward');
  const endedAnimationRef = useRef<string | null>(null);

  const animationsState = useMemo(() => editor.state.animations ?? {}, [editor.state.animations]);
  const animationsMetaState = useMemo(
    () => editor.state.animationsMeta ?? {},
    [editor.state.animationsMeta],
  );
  const runtimeData = useMemo<SpriteData>(() => {
    return {
      frames: editor.state.frames.map(({ id: _id, ...frame }) => ({ ...frame })),
      animations: animationsState,
      meta: editor.state.meta ?? {},
    } satisfies SpriteData;
  }, [animationsState, editor.state.frames, editor.state.meta]);

  useEffect(() => {
    const animator = animatorRef.current;
    animator?.pause();
    endedAnimationRef.current = null;
    setIsPlaying(false);
    setFrameCursor((prev) => {
      if (!runtimeData.frames.length) {
        return 0;
      }
      if (!Number.isFinite(prev) || prev < 0) {
        return 0;
      }
      const maxFrame = runtimeData.frames.length - 1;
      if (prev > maxFrame) {
        return maxFrame;
      }
      return prev;
    });
    setTimelineCursor((prev) => {
      const activeName = animator?.getCurrentAnimation?.() ?? null;
      const sequence =
        activeName && runtimeData.animations ? (runtimeData.animations[activeName] ?? []) : [];
      if (!sequence.length) {
        return null;
      }
      if (prev === null || !Number.isFinite(prev) || prev < 0) {
        return 0;
      }
      const maxCursor = sequence.length - 1;
      if (prev > maxCursor) {
        return maxCursor;
      }
      return prev;
    });
  }, [runtimeData.animations, runtimeData.frames]);

  const play = useCallback(
    (name?: string | null, opts?: PlayOptions) => {
      if (!animatorRef.current) {
        return;
      }
      const targetName = name ?? activeAnimation ?? null;
      const sequence = getSequence(targetName);
      const requestedFrame =
        typeof opts?.fromFrame === 'number' && Number.isFinite(opts.fromFrame)
          ? Math.max(0, Math.floor(opts.fromFrame))
          : undefined;
      const isAtEnd =
        sequence.length > 0 &&
        (frameCursor === sequence[sequence.length - 1] ||
          frameCursor >= editor.state.frames.length - 1);
      const hasEnded = targetName && endedAnimationRef.current === targetName;
      const shouldRestart =
        requestedFrame !== undefined
          ? true
          : (!isPlaying && targetName && sequence.length > 0 && isAtEnd) || hasEnded;
      const resolvedDirection: SpriteAnimatorDirection =
        opts?.direction === 'reverse' || opts?.direction === 'forward'
          ? opts.direction
          : playDirection;
      const options =
        requestedFrame !== undefined
          ? { speedScale, fromFrame: requestedFrame, direction: resolvedDirection }
          : shouldRestart && sequence.length > 0
            ? {
                speedScale,
                fromFrame: resolvedDirection === 'reverse' ? sequence.length - 1 : 0,
                direction: resolvedDirection,
              }
            : { speedScale, direction: resolvedDirection };
      animatorRef.current.play(targetName ?? undefined, options);
      setActiveAnimation(targetName);
      setIsPlaying(true);
      setPlayDirection(resolvedDirection);
      if (requestedFrame !== undefined) {
        setFrameCursor(requestedFrame);
      } else if (shouldRestart && sequence.length > 0) {
        const restartFrame =
          resolvedDirection === 'reverse' ? sequence[sequence.length - 1] : sequence[0];
        setFrameCursor(restartFrame);
      }
      if (hasEnded || requestedFrame !== undefined) {
        endedAnimationRef.current = null;
      }
    },
    [
      activeAnimation,
      editor.state.frames.length,
      frameCursor,
      getSequence,
      isPlaying,
      playDirection,
      speedScale,
    ],
  );

  const stop = useCallback(() => {
    animatorRef.current?.stop();
    setIsPlaying(false);
    setFrameCursor(0);
  }, []);

  const pause = useCallback(() => {
    animatorRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlayback = useCallback(
    (name?: string | null) => {
      if (isPlaying) {
        pause();
        return;
      }
      play(name);
    },
    [isPlaying, pause, play],
  );

  const playForward = useCallback(
    (name?: string | null, opts?: Omit<PlayOptions, 'direction'>) => {
      play(name, { ...opts, direction: 'forward' });
    },
    [play],
  );

  const playReverse = useCallback(
    (name?: string | null, opts?: Omit<PlayOptions, 'direction'>) => {
      play(name, { ...opts, direction: 'reverse' });
    },
    [play],
  );

  const seekFrame = useCallback(
    (frameIndex: number, opts?: SeekFrameOptions) => {
      const animator = animatorRef.current;
      const fallbackFrameIndex = Number.isFinite(frameIndex)
        ? Math.max(0, Math.floor(frameIndex))
        : 0;
      const targetAnimation =
        opts?.animationName ?? animator?.getCurrentAnimation?.() ?? activeAnimation ?? null;
      const sequenceOverride = Array.isArray(opts?.sequenceOverride) ? opts.sequenceOverride : null;
      const sequence = sequenceOverride ?? getSequence(targetAnimation);
      const clampCursor = (value: number) => {
        if (!sequence.length) {
          return 0;
        }
        const intValue = Math.floor(value);
        if (intValue < 0) {
          return 0;
        }
        if (intValue > sequence.length - 1) {
          return sequence.length - 1;
        }
        return intValue;
      };

      if (!sequence.length) {
        if (animator) {
          animator.setFrame(Math.max(0, Math.floor(fallbackFrameIndex)), {
            animationName: targetAnimation ?? null,
          });
        }
        setFrameCursor(fallbackFrameIndex);
        setTimelineCursor(null);
        return;
      }

      let cursorIndex: number | null =
        typeof opts?.cursor === 'number' ? clampCursor(opts.cursor) : null;
      if (cursorIndex === null) {
        cursorIndex = sequence.findIndex((value) => value === fallbackFrameIndex);
        if (cursorIndex < 0) {
          cursorIndex = clampCursor(fallbackFrameIndex);
        }
      }

      const resolvedCursor = clampCursor(cursorIndex);
      if (animator) {
        animator.setFrame(resolvedCursor, { animationName: targetAnimation ?? null });
      }
      const resolvedFrameIndex = sequence[resolvedCursor] ?? fallbackFrameIndex;
      setFrameCursor(resolvedFrameIndex);
      setTimelineCursor(resolvedCursor);
    },
    [activeAnimation, getSequence],
  );

  const onFrameChange = useCallback((event: SpriteAnimatorFrameChangeEvent) => {
    setFrameCursor(event.frameIndex);
    setTimelineCursor(event.frameCursor);
  }, []);

  const getSequence = useCallback(
    (name: string | null | undefined) => {
      if (!name) {
        return [];
      }
      const animationsMap = editor.state.animations ?? {};
      return animationsMap[name] ?? runtimeData.animations?.[name] ?? [];
    },
    [editor.state.animations, runtimeData.animations],
  );

  const onAnimationEnd = useCallback(
    (name: string | null) => {
      setIsPlaying(false);
      endedAnimationRef.current = name ?? null;
      const sequence = getSequence(name);
      if (!sequence.length) {
        return;
      }
      const cursor = playDirection === 'reverse' ? 0 : Math.max(0, sequence.length - 1);
      const frameIndex = sequence[cursor];
      setFrameCursor(frameIndex);
      setTimelineCursor(cursor);
    },
    [getSequence, playDirection],
  );

  const availableAnimations = useMemo(
    () => Object.keys(editor.state.animations ?? {}),
    [editor.state.animations],
  );

  useEffect(() => {
    if (activeAnimation && !availableAnimations.includes(activeAnimation)) {
      setActiveAnimation(null);
    }
  }, [activeAnimation, availableAnimations]);

  const selectedFrameIndex = useMemo(() => {
    if (!editor.state.selected.length) {
      return null;
    }
    const targetId = editor.state.selected[0];
    const index = editor.state.frames.findIndex((frame) => frame.id === targetId);
    return index >= 0 ? index : null;
  }, [editor.state.frames, editor.state.selected]);

  return {
    animatorRef,
    runtimeData,
    animationsMeta: animationsMetaState,
    speedScale,
    setSpeedScale,
    playDirection,
    setPlayDirection,
    activeAnimation,
    setActiveAnimation,
    availableAnimations,
    play,
    playForward,
    playReverse,
    stop,
    pause,
    togglePlayback,
    seekFrame,
    isPlaying,
    frameCursor,
    timelineCursor,
    onFrameChange,
    onAnimationEnd,
    selectedFrameIndex,
  } as const;
};

export type EditorIntegration = ReturnType<typeof useEditorIntegration>;
