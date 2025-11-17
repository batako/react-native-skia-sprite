import { useCallback, useMemo, useState } from 'react';
import type { SpriteEditorFrame } from 'react-native-skia-sprite-animator';

export interface TimelineState {
  clipboard: number[] | null;
  selectedIndex: number | null;
  measuredHeight: number;
  filledHeight: number;
}

export interface UseTimelineEditorOptions {
  frames: SpriteEditorFrame[];
  sequence: number[];
}

export interface TimelineEditorApi {
  state: TimelineState;
  setSelectedIndex: (index: number | null) => void;
  copySelection: () => void;
  pasteSelection: (count?: number) => void;
  moveSelection: (direction: -1 | 1) => void;
  removeSelection: () => void;
}

export const useTimelineEditor = ({
  frames,
  sequence,
}: UseTimelineEditorOptions): TimelineEditorApi => {
  const [clipboard, setClipboard] = useState<number[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [filledHeight, setFilledHeight] = useState(0);

  const copySelection = useCallback(() => {
    if (selectedIndex === null) {
      return;
    }
    const frameIndex = sequence[selectedIndex];
    if (typeof frameIndex === 'number') {
      setClipboard([frameIndex]);
    }
  }, [selectedIndex, sequence]);

  const pasteSelection = useCallback(
    (count = 1) => {
      if (!clipboard?.length) {
        return;
      }
      const insertIndex =
        selectedIndex !== null ? Math.max(selectedIndex + 1, 0) : sequence.length;
      const payload: number[] = [];
      for (let i = 0; i < count; i += 1) {
        payload.push(clipboard[i % clipboard.length]!);
      }
      // NOTE: This hook currently does not mutate the upstream sequence; integration will handle it.
    },
    [clipboard, selectedIndex, sequence.length],
  );

  const moveSelection = useCallback(
    (_direction: -1 | 1) => {
      // placeholder: real mutation handled by parent for now
    },
    [],
  );

  const removeSelection = useCallback(() => {
    // placeholder to be wired later
  }, []);

  return {
    state: {
      clipboard,
      selectedIndex,
      measuredHeight,
      filledHeight,
    },
    setSelectedIndex,
    copySelection,
    pasteSelection,
    moveSelection,
    removeSelection,
  };
};
