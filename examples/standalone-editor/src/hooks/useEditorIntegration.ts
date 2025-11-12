import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SpriteAnimatorFrameChangeEvent,
  SpriteAnimatorHandle,
  SpriteData,
  SpriteEditorApi,
} from 'react-native-skia-sprite-animator';

export interface UseEditorIntegrationOptions {
  editor: SpriteEditorApi;
}

export const useEditorIntegration = ({ editor }: UseEditorIntegrationOptions) => {
  const animatorRef = useRef<SpriteAnimatorHandle>(null);
  const [speedScale, setSpeedScale] = useState(1);
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameCursor, setFrameCursor] = useState(0);

  const runtimeData = useMemo<SpriteData>(() => {
    return {
      frames: editor.state.frames.map(({ id: _id, ...frame }) => ({ ...frame })),
      animations: editor.state.animations,
      animationsMeta: editor.state.animationsMeta,
      meta: editor.state.meta,
    } satisfies SpriteData;
  }, [
    editor.state.animations,
    editor.state.animationsMeta,
    editor.state.frames,
    editor.state.meta,
  ]);

  useEffect(() => {
    animatorRef.current?.stop();
    setIsPlaying(false);
    setFrameCursor(0);
  }, [runtimeData.frames, runtimeData.animations]);

  const play = useCallback(
    (name?: string | null) => {
      if (!animatorRef.current) {
        return;
      }
      animatorRef.current.play(name ?? undefined, { speedScale });
      setActiveAnimation(name ?? null);
      setIsPlaying(true);
    },
    [speedScale],
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

  const resume = useCallback(() => {
    animatorRef.current?.resume();
    setIsPlaying(true);
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

  const seekFrame = useCallback((frameIndex: number) => {
    animatorRef.current?.setFrame(frameIndex);
    setFrameCursor(frameIndex);
  }, []);

  const onFrameChange = useCallback((event: SpriteAnimatorFrameChangeEvent) => {
    setFrameCursor(event.frameIndex);
  }, []);

  const availableAnimations = useMemo(
    () => Object.keys(editor.state.animations),
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
    speedScale,
    setSpeedScale,
    activeAnimation,
    setActiveAnimation,
    availableAnimations,
    play,
    stop,
    pause,
    resume,
    togglePlayback,
    seekFrame,
    isPlaying,
    frameCursor,
    onFrameChange,
    selectedFrameIndex,
  } as const;
};

export type EditorIntegration = ReturnType<typeof useEditorIntegration>;
