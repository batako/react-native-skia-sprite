import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { SpriteEditorApi, SpriteEditorFrame } from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { MaterialIcons } from '@expo/vector-icons';
import { IconButton, type IconButtonRenderIconProps } from './IconButton';
import { MacWindow, type MacWindowVariant } from './MacWindow';
import { PreviewPlayer } from './PreviewPlayer';
import { FrameGridSelector, type FrameGridCell } from './FrameGridSelector';
import { SelectableTextInput } from './SelectableTextInput';
import type { EditorIntegration } from '../hooks/useEditorIntegration';

interface AnimationStudioProps {
  editor: SpriteEditorApi;
  integration: EditorIntegration;
  image: DataSourceParam;
  onSelectImage?: () => void;
}

const DEFAULT_ANIMATION_FPS = 5;
const MIN_ANIMATION_FPS = 1;
const MAX_ANIMATION_FPS = 60;
const TIMELINE_CARD_SIZE = 150;
const TIMELINE_CARD_PADDING = 10;
const TIMELINE_FOOTER_HEIGHT = 28;

type AnimationSettingsMeta = {
  fps?: Record<string, number>;
};

const getAnimationSettings = (meta: Record<string, unknown> | undefined): AnimationSettingsMeta => {
  const settings = (meta as { animationSettings?: AnimationSettingsMeta })?.animationSettings;
  return settings ?? {};
};

const getAnimationFps = (settings: AnimationSettingsMeta, name: string | undefined): number => {
  if (!name) {
    return DEFAULT_ANIMATION_FPS;
  }
  const value = settings.fps?.[name];
  if (typeof value === 'number' && Number.isFinite(value) && value >= MIN_ANIMATION_FPS) {
    return value;
  }
  return DEFAULT_ANIMATION_FPS;
};

const clampFps = (value: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_ANIMATION_FPS;
  }
  if (value < MIN_ANIMATION_FPS) {
    return MIN_ANIMATION_FPS;
  }
  if (value > MAX_ANIMATION_FPS) {
    return MAX_ANIMATION_FPS;
  }
  return value;
};

const fpsToDuration = (fps: number) => {
  const safeFps = Math.max(MIN_ANIMATION_FPS, fps);
  return 1000 / safeFps;
};

const renameRecordKey = <T,>(
  record: Record<string, T> | undefined,
  from: string,
  to: string,
): Record<string, T> => {
  if (!record) {
    return {};
  }
  let renamed = false;
  const entries = Object.entries(record);
  const next: Record<string, T> = {};
  entries.forEach(([key, value]) => {
    if (key === from) {
      next[to] = value;
      renamed = true;
    } else {
      next[key] = value;
    }
  });
  return renamed ? next : { ...record };
};

export const AnimationStudio = ({
  editor,
  integration,
  image,
  onSelectImage,
}: AnimationStudioProps) => {
  const frames = editor.state.frames;
  const editorMeta = editor.state.meta;
  const animations = useMemo(() => editor.state.animations ?? {}, [editor.state.animations]);
  const animationsMeta = useMemo(
    () => editor.state.animationsMeta ?? {},
    [editor.state.animationsMeta],
  );
  const [timelineClipboard, setTimelineClipboard] = useState<number[] | null>(null);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number | null>(null);
  const [renamingAnimation, setRenamingAnimation] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [timelineMeasuredHeight, setTimelineMeasuredHeight] = useState(0);
  const [timelineFilledHeight, setTimelineFilledHeight] = useState(0);
  const [isFramePickerVisible, setFramePickerVisible] = useState(false);
  const [framePickerVariant, setFramePickerVariant] = useState<MacWindowVariant>('default');
  const {
    activeAnimation,
    setActiveAnimation,
    playForward,
    playReverse,
    pause,
    stop,
    seekFrame,
    isPlaying,
    frameCursor,
    timelineCursor,
  } = integration;
  const multiplierFieldRef = useRef<MultiplierFieldHandle>(null);
  const commitPendingMultiplier = useCallback(() => {
    multiplierFieldRef.current?.commit();
  }, []);
  const setTimelineSelection = useCallback<React.Dispatch<React.SetStateAction<number | null>>>(
    (value) => {
      commitPendingMultiplier();
      setSelectedTimelineIndex(value);
    },
    [commitPendingMultiplier],
  );

  const renderResumeForwardIcon = useCallback(
    ({ color, size }: IconButtonRenderIconProps) => (
      <View style={styles.resumeIcon}>
        <View style={[styles.resumeIconBar, { backgroundColor: color, height: size }]} />
        <MaterialIcons name="play-arrow" size={size} color={color} />
      </View>
    ),
    [],
  );

  const renderResumeReverseIcon = useCallback(
    ({ color, size }: IconButtonRenderIconProps) => (
      <View style={[styles.resumeIcon, styles.resumeIconReverse]}>
        <View style={[styles.resumeIconBar, { backgroundColor: color, height: size }]} />
        <MaterialIcons name="play-arrow" size={size} color={color} style={styles.reverseIcon} />
      </View>
    ),
    [],
  );

  const cancelRename = useCallback(() => {
    setRenamingAnimation(null);
    setRenameDraft('');
    setRenameError(null);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (!renamingAnimation) {
      return;
    }
    const nextName = renameDraft.trim();
    if (!nextName.length) {
      setRenameError('Please enter a name');
      return;
    }
    if (nextName !== renamingAnimation && animations[nextName]) {
      setRenameError('An animation with the same name already exists');
      return;
    }
    if (nextName !== renamingAnimation) {
      const sourceSequence = animations[renamingAnimation] ?? [];
      const nextAnimations = renameRecordKey(animations, renamingAnimation, nextName);
      if (!Object.prototype.hasOwnProperty.call(nextAnimations, nextName)) {
        nextAnimations[nextName] = sourceSequence;
      }
      editor.setAnimations(nextAnimations);

      const settings = getAnimationSettings(editorMeta);
      const nextFps = renameRecordKey(settings.fps, renamingAnimation, nextName);
      const nextMultipliers = renameRecordKey(settings.multipliers, renamingAnimation, nextName);
      editor.updateMeta({
        animationSettings: {
          ...settings,
          fps: Object.keys(nextFps).length ? nextFps : undefined,
          multipliers: Object.keys(nextMultipliers).length ? nextMultipliers : undefined,
        },
      });
      const nextAnimationsMeta = renameRecordKey(animationsMeta, renamingAnimation, nextName);
      editor.setAnimationsMeta(nextAnimationsMeta);
      setActiveAnimation(nextName);
    }
    cancelRename();
  }, [
    animations,
    animationsMeta,
    cancelRename,
    editor,
    editorMeta,
    renamingAnimation,
    renameDraft,
    setActiveAnimation,
  ]);

  const handleSelectAnimationItem = useCallback(
    (name: string) => {
      if (!name || name === currentAnimationName) {
        return;
      }
      if (isPlaying) {
        stop();
      }
      setActiveAnimation(name);
      const nextSequence = animations[name] ?? [];
      if (nextSequence.length) {
        setTimelineSelection(0);
        seekFrame(nextSequence[0], {
          cursor: 0,
          animationName: name,
          sequenceOverride: nextSequence,
        });
      } else {
        setTimelineSelection(null);
      }
    },
    [
      animations,
      currentAnimationName,
      isPlaying,
      seekFrame,
      setActiveAnimation,
      setTimelineSelection,
      stop,
    ],
  );

  const handleAnimationListPress = useCallback(
    (name: string) => {
      if (renamingAnimation && renamingAnimation !== name) {
        handleRenameSubmit();
      }
      if (currentAnimationName === name) {
        if (renamingAnimation !== name) {
          setRenamingAnimation(name);
          setRenameDraft(name);
          setRenameError(null);
        }
        return;
      }
      cancelRename();
      handleSelectAnimationItem(name);
    },
    [
      cancelRename,
      currentAnimationName,
      handleRenameSubmit,
      handleSelectAnimationItem,
      renamingAnimation,
      setRenamingAnimation,
      setRenameDraft,
      setRenameError,
    ],
  );

  const animationNames = useMemo(() => Object.keys(animations), [animations]);

  useEffect(() => {
    if (renamingAnimation && renamingAnimation !== currentAnimationName) {
      cancelRename();
    }
    if (!animationNames.length) {
      return;
    }
    if (!activeAnimation || !animationNames.includes(activeAnimation)) {
      setActiveAnimation(animationNames[0]);
    }
  }, [
    activeAnimation,
    animationNames,
    cancelRename,
    currentAnimationName,
    renamingAnimation,
    setActiveAnimation,
  ]);

  const currentAnimationName = activeAnimation ?? animationNames[0];
  const hasActiveAnimation = Boolean(currentAnimationName);
  const currentSequence = useMemo(
    () => (currentAnimationName ? (animations[currentAnimationName] ?? []) : []),
    [animations, currentAnimationName],
  );
  const animationSettings = useMemo(() => getAnimationSettings(editorMeta), [editorMeta]);
  const currentAnimationFps = getAnimationFps(animationSettings, currentAnimationName);
  const currentAnimationLoop = currentAnimationName
    ? (animationsMeta[currentAnimationName]?.loop ?? true)
    : true;
  const currentAnimationAutoPlay = currentAnimationName
    ? Boolean(animationsMeta[currentAnimationName]?.autoPlay)
    : false;
  const currentBaseDuration = fpsToDuration(currentAnimationFps);

  const lastAnimationRef = useRef<string | null>(null);
  useEffect(() => {
    const nextName = currentAnimationName ?? null;
    const nextSequence = nextName ? (animations[nextName] ?? []) : [];
    const animationChanged = lastAnimationRef.current !== nextName;
    lastAnimationRef.current = nextName;

    if (!nextSequence.length) {
      setTimelineSelection(null);
      return;
    }

    if (animationChanged) {
      setTimelineSelection(() => 0);
      return;
    }

    setTimelineSelection((prev) => {
      if (prev === null || prev >= nextSequence.length) {
        return 0;
      }
      return prev;
    });
  }, [animations, currentAnimationName, setTimelineSelection]);

  useEffect(() => {
    if (timelineCursor === null) {
      return;
    }
    if (timelineCursor < 0 || timelineCursor >= currentSequence.length) {
      return;
    }
    setTimelineSelection((prev) => {
      if (prev === timelineCursor) {
        return prev;
      }
      return timelineCursor;
    });
  }, [currentSequence.length, setTimelineSelection, timelineCursor]);

  const resolvePlaybackStartCursor = useCallback(
    (direction: 'forward' | 'reverse' = 'forward') => {
      if (!currentSequence.length) {
        return null;
      }
      const lastCursor = currentSequence.length - 1;
      let start =
        selectedTimelineIndex !== null &&
        selectedTimelineIndex >= 0 &&
        selectedTimelineIndex < currentSequence.length
          ? selectedTimelineIndex
          : timelineCursor !== null &&
              timelineCursor >= 0 &&
              timelineCursor < currentSequence.length
            ? timelineCursor
            : 0;
      if (!currentAnimationLoop) {
        if (direction === 'forward' && start === lastCursor) {
          start = 0;
        } else if (direction === 'reverse' && start === 0) {
          start = lastCursor;
        }
      }
      return start;
    },
    [currentAnimationLoop, currentSequence.length, selectedTimelineIndex, timelineCursor],
  );

  const handlePlayFromSelection = useCallback(() => {
    if (!currentAnimationName || !currentSequence.length) {
      return;
    }
    const startCursor = resolvePlaybackStartCursor();
    if (startCursor === null) {
      return;
    }
    playForward(currentAnimationName, { fromFrame: startCursor });
  }, [currentAnimationName, currentSequence.length, playForward, resolvePlaybackStartCursor]);

  const handleReverseFromSelection = useCallback(() => {
    if (!currentAnimationName || !currentSequence.length) {
      return;
    }
    const startCursor = resolvePlaybackStartCursor('reverse');
    if (startCursor === null) {
      return;
    }
    playReverse(currentAnimationName, { fromFrame: startCursor });
  }, [currentAnimationName, currentSequence.length, playReverse, resolvePlaybackStartCursor]);

  const imageInfo = useImageDimensions(image);
  const timelineImageSource = useMemo(() => resolveReactNativeImageSource(image), [image]);
  const adjustFrameDurationsForAnimation = useCallback(
    (name: string, prevFps: number, nextFps: number) => {
      const prevBase = fpsToDuration(prevFps);
      const nextBase = fpsToDuration(nextFps);
      const sequence = animations[name] ?? [];
      const uniqueIndexes = Array.from(new Set(sequence));
      uniqueIndexes.forEach((frameIndex) => {
        const frame = frames[frameIndex];
        if (!frame) {
          return;
        }
        const currentDuration = frame.duration ?? prevBase;
        const multiplier = currentDuration / prevBase;
        const nextDuration = Math.max(1, nextBase * multiplier);
        editor.updateFrame(frame.id, { duration: nextDuration });
      });
    },
    [animations, editor, frames],
  );

  const updateAnimationFpsMeta = useCallback(
    (name: string, fps: number) => {
      const settings = getAnimationSettings(editorMeta);
      const nextSettings: AnimationSettingsMeta = {
        ...settings,
        fps: { ...(settings.fps ?? {}), [name]: fps },
      };
      editor.updateMeta({
        animationSettings: nextSettings,
      });
    },
    [editor, editorMeta],
  );
  const handleAnimationFpsChange = useCallback(
    (nextFps: number) => {
      if (!currentAnimationName) {
        return;
      }
      const prevFps = getAnimationFps(animationSettings, currentAnimationName);
      const clamped = clampFps(nextFps);
      if (clamped === prevFps) {
        return;
      }
      updateAnimationFpsMeta(currentAnimationName, clamped);
      adjustFrameDurationsForAnimation(currentAnimationName, prevFps, clamped);
    },
    [
      adjustFrameDurationsForAnimation,
      animationSettings,
      currentAnimationName,
      updateAnimationFpsMeta,
    ],
  );

  const updateSequence = useCallback(
    (next: number[] | ((prev: number[]) => number[])): number[] => {
      if (!currentAnimationName) {
        return [];
      }
      const prevSequence = animations[currentAnimationName] ?? [];
      const nextSequence = typeof next === 'function' ? next(prevSequence) : next;
      editor.setAnimations({
        ...animations,
        [currentAnimationName]: nextSequence,
      });
      return nextSequence;
    },
    [animations, currentAnimationName, editor],
  );

  const handleGridAddFrames = useCallback(
    (cells: FrameGridCell[]) => {
      if (!cells.length) {
        return;
      }
      const startIndex = editor.state.frames.length;
      const newIndexes: number[] = [];
      cells.forEach((cell, idx) => {
        editor.addFrame({
          x: cell.x,
          y: cell.y,
          w: cell.width,
          h: cell.height,
          duration: currentBaseDuration,
        });
        newIndexes.push(startIndex + idx);
        updateAnimationMultiplierMeta(currentAnimationName ?? '', startIndex + idx, 1);
      });
      const nextSequence = updateSequence((prevSequence) => [...prevSequence, ...newIndexes]);
      if (newIndexes.length && nextSequence.length) {
        const timelineIndex = nextSequence.length - newIndexes.length;
        setTimelineSelection(timelineIndex);
      }
    },
    [
      currentAnimationName,
      currentBaseDuration,
      editor,
      setTimelineSelection,
      updateAnimationMultiplierMeta,
      updateSequence,
    ],
  );

  const handleAddAnimation = () => {
    let counter = animationNames.length + 1;
    let name = `animation_${counter}`;
    while (animations[name]) {
      counter += 1;
      name = `animation_${counter}`;
    }
    editor.setAnimations({
      ...animations,
      [name]: [],
    });
    setActiveAnimation(name);
  };

  const handleDeleteAnimation = useCallback(
    (name: string) => {
      const next = { ...animations };
      delete next[name];
      editor.setAnimations(next);
      const settings = getAnimationSettings(editorMeta);
      const nextFps = { ...(settings.fps ?? {}) };
      const nextMultipliers = { ...(settings.multipliers ?? {}) };
      delete nextFps[name];
      delete nextMultipliers[name];
      editor.updateMeta({
        animationSettings: {
          ...settings,
          fps: Object.keys(nextFps).length ? nextFps : undefined,
          multipliers: Object.keys(nextMultipliers).length ? nextMultipliers : undefined,
        },
      });
      const nextAnimationsMeta = { ...animationsMeta };
      delete nextAnimationsMeta[name];
      editor.setAnimationsMeta(nextAnimationsMeta);
      if (activeAnimation === name) {
        const remaining = Object.keys(next);
        setActiveAnimation(remaining.length ? remaining[0] : null);
      }
    },
    [activeAnimation, animations, animationsMeta, editor, editorMeta, setActiveAnimation],
  );

  const handleToggleAnimationLoop = useCallback(() => {
    if (!currentAnimationName) {
      return;
    }
    const currentFrame = frameCursor;
    const prev = animationsMeta[currentAnimationName]?.loop ?? true;
    const nextAnimationsMeta = {
      ...animationsMeta,
      [currentAnimationName]: {
        ...(animationsMeta[currentAnimationName] ?? {}),
        loop: !prev,
      },
    };
    editor.setAnimationsMeta(nextAnimationsMeta);
    if (!isPlaying) {
      requestAnimationFrame(() => seekFrame(currentFrame));
    }
  }, [animationsMeta, currentAnimationName, editor, frameCursor, isPlaying, seekFrame]);

  const handleToggleAnimationAutoPlay = useCallback(() => {
    if (!currentAnimationName) {
      return;
    }
    const prevAuto = Boolean(animationsMeta[currentAnimationName]?.autoPlay);
    const nextAnimationsMeta = {
      ...animationsMeta,
      [currentAnimationName]: {
        ...(animationsMeta[currentAnimationName] ?? {}),
        autoPlay: !prevAuto,
      },
    };
    editor.setAnimationsMeta(nextAnimationsMeta);
  }, [animationsMeta, currentAnimationName, editor]);

  const confirmDeleteAnimation = useCallback(
    (name: string) => {
      Alert.alert('Delete animation?', 'Are you sure you want to remove this animation?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteAnimation(name) },
      ]);
    },
    [handleDeleteAnimation],
  );

  const handleCopyTimelineFrame = () => {
    if (selectedTimelineIndex === null) {
      return;
    }
    const frameIndex = currentSequence[selectedTimelineIndex];
    if (typeof frameIndex === 'number') {
      setTimelineClipboard([frameIndex]);
    }
  };

  const handlePasteTimelineFrame = () => {
    if (!timelineClipboard?.length) {
      return;
    }
    const insertIndex =
      selectedTimelineIndex !== null ? selectedTimelineIndex + 1 : currentSequence.length;
    const next = [...currentSequence];
    next.splice(insertIndex, 0, ...timelineClipboard);
    updateSequence(next);
    setTimelineSelection(insertIndex);
  };

  const handleRemoveTimelineFrame = () => {
    if (selectedTimelineIndex === null) {
      return;
    }
    const next = [...currentSequence];
    next.splice(selectedTimelineIndex, 1);
    updateSequence(next);
    setTimelineSelection((prev) => {
      if (prev === null) {
        return prev;
      }
      return Math.max(0, Math.min(next.length - 1, prev));
    });
  };

  const selectTimelineFrame = useCallback(
    (timelineIndex: number, sequenceOverride?: number[]) => {
      setTimelineSelection(timelineIndex);
      const sequence = sequenceOverride ?? currentSequence;
      const frameIndex = sequence[timelineIndex];
      if (typeof frameIndex === 'number') {
        seekFrame(frameIndex, {
          cursor: timelineIndex,
          animationName: currentAnimationName ?? null,
          sequenceOverride: sequence,
        });
      }
    },
    [currentAnimationName, currentSequence, seekFrame, setTimelineSelection],
  );

  const handleMoveTimelineFrame = (direction: -1 | 1) => {
    if (selectedTimelineIndex === null) {
      return;
    }
    const targetIndex = selectedTimelineIndex + direction;
    if (targetIndex < 0 || targetIndex >= currentSequence.length) {
      return;
    }
    const next = [...currentSequence];
    const [item] = next.splice(selectedTimelineIndex, 1);
    next.splice(targetIndex, 0, item);
    updateSequence(next);
    selectTimelineFrame(targetIndex, next);
  };

  const sequenceCards = currentSequence.map((frameIndex, idx) => {
    const frame = frames[frameIndex];
    return {
      frame,
      frameIndex,
      timelineIndex: idx,
      isSelected: idx === selectedTimelineIndex,
    };
  });

  const selectedFrame = useMemo<SpriteEditorFrame | null>(() => {
    if (selectedTimelineIndex === null) {
      return null;
    }
    const frameIndex = currentSequence[selectedTimelineIndex];
    if (typeof frameIndex !== 'number') {
      return null;
    }
    return frames[frameIndex] ?? null;
  }, [currentSequence, frames, selectedTimelineIndex]);

  useEffect(() => {
    if (selectedTimelineIndex === null) {
      return;
    }
    const frameIndex = currentSequence[selectedTimelineIndex];
    if (typeof frameIndex !== 'number') {
      return;
    }
    seekFrame(frameIndex, {
      cursor: selectedTimelineIndex,
      animationName: currentAnimationName ?? null,
      sequenceOverride: currentSequence,
    });
  }, [currentAnimationName, currentSequence, seekFrame, selectedTimelineIndex]);

  const selectedMultiplier = useMemo(() => {
    if (currentAnimationName && selectedTimelineIndex !== null) {
      const stored = animationSettings.multipliers?.[currentAnimationName]?.[selectedTimelineIndex];
      if (typeof stored === 'number') {
        return stored;
      }
    }
    if (!selectedFrame) {
      return 1;
    }
    const duration = selectedFrame.duration ?? currentBaseDuration;
    return parseFloat((duration / currentBaseDuration).toFixed(2));
  }, [
    animationSettings.multipliers,
    currentAnimationName,
    currentBaseDuration,
    selectedFrame,
    selectedTimelineIndex,
  ]);

  useEffect(() => {
    if (currentSequence.length > 0 && timelineMeasuredHeight > 0) {
      setTimelineFilledHeight((prev) => Math.max(prev, timelineMeasuredHeight));
    }
  }, [currentSequence.length, timelineMeasuredHeight]);

  const animationColumnStyle = useMemo(() => {
    const stylesArray = [styles.animationListColumn];
    const minHeight = Math.max(
      timelineFilledHeight,
      currentSequence.length > 0 ? timelineMeasuredHeight : 0,
    );
    if (minHeight > 0) {
      stylesArray.push({ minHeight });
    }
    return stylesArray;
  }, [currentSequence.length, timelineFilledHeight, timelineMeasuredHeight]);
  const animationColumnMaxHeight = useMemo(() => {
    return Math.max(timelineFilledHeight, timelineMeasuredHeight, 0);
  }, [timelineFilledHeight, timelineMeasuredHeight]);

  const ensureUniqueFrameForSelection = useCallback(() => {
    if (selectedTimelineIndex === null) {
      return { frame: null, frameIndex: null };
    }
    const frameIndex = currentSequence[selectedTimelineIndex];
    if (typeof frameIndex !== 'number') {
      return { frame: null, frameIndex };
    }
    const frame = frames[frameIndex];
    if (!frame) {
      return { frame: null, frameIndex };
    }
    const totalOccurrences = Object.values(animations).reduce((count, sequence) => {
      return (
        count +
        sequence.reduce((acc, value) => {
          return acc + (value === frameIndex ? 1 : 0);
        }, 0)
      );
    }, 0);
    if (totalOccurrences <= 1) {
      return { frame, frameIndex };
    }
    const clone = editor.addFrame({
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
      duration: frame.duration,
    });
    const newIndex = frames.length;
    const nextSequence = [...currentSequence];
    nextSequence[selectedTimelineIndex] = newIndex;
    updateSequence(nextSequence);
    return { frame: clone, frameIndex: newIndex };
  }, [animations, currentSequence, editor, frames, selectedTimelineIndex, updateSequence]);

  const updateAnimationMultiplierMeta = useCallback(
    (name: string, index: number, multiplier: number) => {
      const settings = getAnimationSettings(editorMeta);
      const nextMultipliers = {
        ...(settings.multipliers ?? {}),
        [name]: {
          ...(settings.multipliers?.[name] ?? {}),
          [index]: multiplier,
        },
      };
      editor.updateMeta({
        animationSettings: {
          ...settings,
          multipliers: nextMultipliers,
        },
      });
    },
    [editor, editorMeta],
  );
  const handleMultiplierSubmit = useCallback(
    (multiplier: number) => {
      if (!currentAnimationName || selectedTimelineIndex === null) {
        return;
      }
      const { frame } = ensureUniqueFrameForSelection();
      if (!frame) {
        return;
      }
      const safeMultiplier = Number.isFinite(multiplier) ? Math.max(0.1, multiplier) : 1;
      if (Math.abs(safeMultiplier - selectedMultiplier) < 0.0001) {
        return;
      }
      const nextDuration = Math.max(1, currentBaseDuration * safeMultiplier);
      // TODO: Replace this conversion once SpriteAnimator natively supports per-animation fps.
      editor.updateFrame(frame.id, { duration: nextDuration });
      updateAnimationMultiplierMeta(currentAnimationName, selectedTimelineIndex, safeMultiplier);
    },
    [
      currentAnimationName,
      currentBaseDuration,
      editor,
      ensureUniqueFrameForSelection,
      selectedMultiplier,
      selectedTimelineIndex,
      updateAnimationMultiplierMeta,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Animation Studio</Text>
        {onSelectImage && (
          <TouchableOpacity style={styles.imagePickerButton} onPress={onSelectImage}>
            <MaterialIcons name="image" size={18} color="#bdc9ff" />
            <Text style={styles.imagePickerText}>Change Image</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.previewSection}>
        <View style={styles.previewHeaderRow}>
          <Text style={styles.sectionTitle}>Animation Preview</Text>
        </View>
        <PreviewPlayer integration={integration} image={image} title="" />
      </View>
      <View style={styles.body}>
        <View style={styles.sequenceGroup}>
          <View
            style={[
              animationColumnStyle,
              animationColumnMaxHeight ? { maxHeight: animationColumnMaxHeight } : null,
            ]}
          >
            <Text style={styles.sectionTitle}>Animations</Text>
            <View style={styles.animationToolbar}>
              <IconButton
                name="add"
                onPress={handleAddAnimation}
                accessibilityLabel="Add animation"
              />
              <IconButton
                name="delete"
                onPress={() => currentAnimationName && confirmDeleteAnimation(currentAnimationName)}
                disabled={!currentAnimationName}
                accessibilityLabel="Delete animation"
              />
              <View style={styles.timelineDivider} />
              <IconButton
                name="play-circle-outline"
                onPress={handleToggleAnimationAutoPlay}
                disabled={!currentAnimationName}
                style={[
                  currentAnimationAutoPlay
                    ? styles.autoPlayButtonActive
                    : styles.autoPlayButtonInactive,
                ]}
                accessibilityLabel={
                  currentAnimationAutoPlay
                    ? 'Disable autoplay metadata for animation'
                    : 'Enable autoplay metadata for animation'
                }
              />
              <View style={styles.timelineDivider} />
              <IconButton
                name="repeat"
                onPress={handleToggleAnimationLoop}
                disabled={!currentAnimationName}
                style={[
                  currentAnimationLoop ? styles.loopButtonActive : styles.loopButtonInactive,
                ]}
                accessibilityLabel={
                  currentAnimationLoop ? 'Disable loop for animation' : 'Enable loop for animation'
                }
              />
            </View>
            {currentAnimationName && (
              <AnimationFpsField value={currentAnimationFps} onSubmit={handleAnimationFpsChange} />
            )}
            <ScrollView
              style={[
                styles.animationList,
                animationColumnMaxHeight
                  ? { maxHeight: Math.max(160, animationColumnMaxHeight - 80) }
                  : null,
              ]}
              contentContainerStyle={styles.animationListContent}
            >
              {animationNames.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.animationListItem,
                    currentAnimationName === name && styles.animationListItemActive,
                  ]}
                  onPress={() => handleAnimationListPress(name)}
                >
                  <View style={styles.animationListItemInner}>
                    {renamingAnimation === name ? (
                      <>
                        <TextInput
                          style={styles.animationRenameInput}
                          value={renameDraft}
                          onChangeText={setRenameDraft}
                          autoFocus
                          onBlur={handleRenameSubmit}
                          onSubmitEditing={handleRenameSubmit}
                        />
                        {renameError && <Text style={styles.renameErrorInline}>{renameError}</Text>}
                      </>
                    ) : (
                      <Text style={styles.animationListItemText}>{name}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View
            style={styles.timelineColumn}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              if (height > 0 && Math.abs(height - timelineMeasuredHeight) > 1) {
                setTimelineMeasuredHeight(height);
              }
            }}
          >
            <View style={styles.timelineHeader}>
              <Text style={styles.sectionTitle}>Animation Frames</Text>
            </View>
            <View style={styles.timelineToolbar}>
              <View style={styles.timelineButtons}>
                <IconButton
                  iconFamily="material"
                  name="play-arrow"
                  onPress={handleReverseFromSelection}
                  disabled={isPlaying || currentSequence.length === 0}
                  accessibilityLabel="Play animation in reverse"
                  iconStyle={styles.reverseIcon}
                />
                <IconButton
                  renderIcon={renderResumeReverseIcon}
                  onPress={() => {
                    if (!currentSequence.length) {
                      return;
                    }
                    stop();
                    playReverse(currentAnimationName, { fromFrame: currentSequence.length - 1 });
                  }}
                  disabled={currentSequence.length === 0}
                  accessibilityLabel="Restart animation in reverse from beginning"
                />
                <IconButton
                  iconFamily="material"
                  name={isPlaying ? 'pause' : 'stop'}
                  onPress={() => (isPlaying ? pause() : stop())}
                  disabled={!hasActiveAnimation || !currentSequence.length}
                  accessibilityLabel={
                    isPlaying ? 'Pause animation preview' : 'Stop animation preview'
                  }
                />
                <IconButton
                  renderIcon={renderResumeForwardIcon}
                  onPress={() => {
                    if (!currentSequence.length) {
                      return;
                    }
                    stop();
                    playForward(currentAnimationName, { fromFrame: 0 });
                  }}
                  disabled={currentSequence.length === 0}
                  accessibilityLabel="Restart animation from beginning"
                />
                <IconButton
                  iconFamily="material"
                  name="play-arrow"
                  onPress={handlePlayFromSelection}
                  disabled={isPlaying || currentSequence.length === 0}
                  accessibilityLabel="Play animation preview"
                />
                <View style={styles.timelineDivider} />
                <IconButton
                  name="grid-on"
                  onPress={() => setFramePickerVisible(true)}
                  disabled={!hasActiveAnimation || isPlaying}
                  accessibilityLabel="Open frame picker modal"
                />
                <View style={styles.timelineDivider} />
                <IconButton
                  name="content-copy"
                  onPress={handleCopyTimelineFrame}
                  disabled={isPlaying || selectedTimelineIndex === null}
                  accessibilityLabel="Copy timeline frame"
                />
                <IconButton
                  name="content-paste"
                  onPress={handlePasteTimelineFrame}
                  disabled={isPlaying || !timelineClipboard?.length}
                  accessibilityLabel="Paste timeline frame"
                />
                <View style={styles.timelineDivider} />
                <IconButton
                  name="skip-previous"
                  onPress={() => handleMoveTimelineFrame(-1)}
                  disabled={
                    isPlaying || selectedTimelineIndex === null || selectedTimelineIndex === 0
                  }
                  accessibilityLabel="Move frame left"
                />
                <IconButton
                  name="skip-next"
                  onPress={() => handleMoveTimelineFrame(1)}
                  disabled={
                    isPlaying ||
                    selectedTimelineIndex === null ||
                    selectedTimelineIndex === currentSequence.length - 1 ||
                    currentSequence.length === 0
                  }
                  accessibilityLabel="Move frame right"
                />
                <IconButton
                  name="delete-forever"
                  onPress={handleRemoveTimelineFrame}
                  disabled={isPlaying || selectedTimelineIndex === null}
                  accessibilityLabel="Remove timeline frame"
                />
              </View>
              <View style={styles.timelineDivider} />
              <MultiplierField
                ref={multiplierFieldRef}
                value={selectedMultiplier}
                disabled={isPlaying || !selectedFrame}
                onSubmit={handleMultiplierSubmit}
              />
            </View>
            <View style={styles.timelineTrack}>
              {sequenceCards.length === 0 ? (
                <View style={styles.emptyTimelineWrapper} />
              ) : (
                <ScrollView
                  horizontal
                  style={styles.timelineScroll}
                  contentContainerStyle={styles.timelineContent}
                  showsHorizontalScrollIndicator={false}
                >
                  {sequenceCards.map(({ frame, frameIndex, timelineIndex, isSelected }) => {
                    const viewportSize =
                      TIMELINE_CARD_SIZE - TIMELINE_FOOTER_HEIGHT - TIMELINE_CARD_PADDING * 2;
                    const frameScale = frame ? viewportSize / Math.max(frame.w, frame.h) : 1;
                    const storedMultiplier =
                      currentAnimationName !== null && currentAnimationName !== undefined
                        ? animationSettings.multipliers?.[currentAnimationName]?.[timelineIndex]
                        : undefined;
                    const computedMultiplier =
                      typeof storedMultiplier === 'number'
                        ? storedMultiplier
                        : frame && currentBaseDuration
                          ? (frame.duration ?? currentBaseDuration) / currentBaseDuration
                          : 1;
                    const multiplierLabel =
                      Math.abs(computedMultiplier - 1) < 0.01
                        ? ''
                        : ` [×${computedMultiplier.toFixed(2)}]`;
                    return (
                      <TouchableOpacity
                        key={`${frameIndex}-${timelineIndex}`}
                        style={[styles.timelineCard, isSelected && styles.timelineCardSelected]}
                        onPress={() => selectTimelineFrame(timelineIndex)}
                      >
                        <View style={styles.timelineCardBody}>
                          {frame && imageInfo.ready && timelineImageSource ? (
                            <View
                              style={[
                                styles.thumb,
                                {
                                  width: viewportSize,
                                  height: viewportSize,
                                },
                              ]}
                            >
                              <View
                                style={{
                                  width: frame.w * frameScale,
                                  height: frame.h * frameScale,
                                  overflow: 'hidden',
                                }}
                              >
                                <Image
                                  source={timelineImageSource}
                                  resizeMode="cover"
                                  style={{
                                    width: imageInfo.width * frameScale,
                                    height: imageInfo.height * frameScale,
                                    transform: [
                                      { translateX: -frame.x * frameScale },
                                      { translateY: -frame.y * frameScale },
                                    ],
                                  }}
                                />
                              </View>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.thumb,
                                styles.thumbPlaceholder,
                                { width: viewportSize, height: viewportSize },
                              ]}
                            >
                              <Text style={styles.thumbPlaceholderText}>No Image</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.timelineCardFooter}>
                          <Text style={styles.timelineCardMeta}>
                            {timelineIndex}
                            {multiplierLabel}
                            {typeof frameIndex === 'number' ? ` f${frameIndex}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </View>
      <Modal
        animationType="slide"
        transparent
        visible={isFramePickerVisible}
        onRequestClose={() => {
          setFramePickerVariant('default');
          setFramePickerVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <MacWindow
            title="Frame Picker"
            onVariantChange={setFramePickerVariant}
            onClose={() => {
              setFramePickerVariant('default');
              setFramePickerVisible(false);
            }}
            enableCompact={false}
            style={framePickerVariant === 'default' ? styles.framePickerWindow : undefined}
            contentStyle={styles.framePickerContent}
          >
            <FrameGridSelector
              image={{ source: image }}
              onAddFrames={(cells) => {
                handleGridAddFrames(cells);
                setFramePickerVisible(false);
              }}
            />
          </MacWindow>
        </View>
      </Modal>
    </View>
  );
};

interface MultiplierFieldProps {
  value: number;
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

interface MultiplierFieldHandle {
  commit: () => void;
}

const MultiplierField = React.forwardRef<MultiplierFieldHandle, MultiplierFieldProps>(
  ({ value, onSubmit, disabled }, ref) => {
    const [text, setText] = useState(value.toFixed(2));

    const commit = useCallback(() => {
      if (disabled) {
        return;
      }
      const parsed = Number(text);
      if (Number.isNaN(parsed)) {
        setText(value.toFixed(2));
        return;
      }
      if (Math.abs(parsed - value) < 0.0001) {
        setText(value.toFixed(2));
        return;
      }
      onSubmit(parsed);
    }, [disabled, onSubmit, text, value]);

    useImperativeHandle(ref, () => ({
      commit,
    }));

    useEffect(() => {
      setText(value.toFixed(2));
    }, [value, disabled]);

    return (
      <View style={styles.multiplierRow}>
        <Text style={styles.multiplierLabel}>Multiplier</Text>
        <SelectableTextInput
          style={[styles.multiplierInput, disabled && styles.multiplierInputDisabled]}
          keyboardType="numeric"
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          editable={!disabled}
        />
        <Text style={styles.multiplierUnit}>×</Text>
      </View>
    );
  },
);
MultiplierField.displayName = 'MultiplierField';

interface AnimationFpsFieldProps {
  value: number;
  onSubmit: (value: number) => void;
}

const AnimationFpsField = ({ value, onSubmit }: AnimationFpsFieldProps) => {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text);
    if (!Number.isNaN(parsed)) {
      onSubmit(parsed);
    } else {
      setText(String(value));
    }
  };

  return (
    <View style={styles.animationFpsRow}>
      <Text style={styles.animationFpsLabel}>FPS</Text>
      <SelectableTextInput
        style={styles.animationFpsInput}
        keyboardType="numeric"
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
      />
    </View>
  );
};

const useImageDimensions = (source: DataSourceParam) => {
  const [state, setState] = useState({ width: 0, height: 0, ready: false });

  useEffect(() => {
    if (typeof source === 'number') {
      const resolved = Image.resolveAssetSource(source);
      if (resolved?.width && resolved?.height) {
        setState({ width: resolved.width, height: resolved.height, ready: true });
      }
      return;
    }
    const uri = typeof source === 'string' ? source : (source as { uri?: string }).uri;
    if (!uri) {
      setState({ width: 0, height: 0, ready: false });
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) {
          setState({ width, height, ready: true });
        }
      },
      () => {
        if (!cancelled) {
          setState({ width: 0, height: 0, ready: false });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  return state;
};

const resolveReactNativeImageSource = (
  value: DataSourceParam | undefined,
): ImageSourcePropType | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'number') {
    return value as ImageSourcePropType;
  }
  if (typeof value === 'string') {
    return { uri: value };
  }
  if (Array.isArray(value)) {
    return value as ImageSourcePropType;
  }
  if (typeof value === 'object') {
    if (
      'uri' in (value as Record<string, unknown>) &&
      typeof (value as { uri?: string }).uri === 'string'
    ) {
      return value as ImageSourcePropType;
    }
    if ('source' in (value as Record<string, unknown>)) {
      const descriptor = value as { source?: DataSourceParam };
      if (descriptor.source) {
        return resolveReactNativeImageSource(descriptor.source);
      }
    }
  }
  return null;
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#10141d',
    borderWidth: 1,
    borderColor: '#1f2430',
  },
  header: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: '#f1f5ff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
  },
  animationRenameContainer: {
    width: '100%',
    flexDirection: 'column',
    gap: 2,
  },
  animationRenameInput: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2f3850',
    color: '#fff',
    backgroundColor: '#191f2d',
    height: 32,
  },
  renameErrorInline: {
    color: '#ff6b6b',
    fontSize: 11,
    lineHeight: 12,
  },
  previewSection: {
    marginTop: 12,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2436',
    backgroundColor: '#151b2a',
    padding: 16,
    alignItems: 'center',
  },
  previewHeaderRow: {
    width: '100%',
    marginBottom: 8,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3147',
    backgroundColor: '#1c2233',
  },
  imagePickerText: {
    color: '#dfe7ff',
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    marginTop: 16,
    width: '100%',
  },
  sequenceGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2436',
    backgroundColor: '#151b2a',
    padding: 16,
  },
  animationListColumn: {
    width: 200,
    minWidth: 160,
  },
  animationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  animationToolbar: {
    flexDirection: 'row',
    marginTop: 8,
  },
  loopButtonActive: {
    backgroundColor: '#28a745',
  },
  loopButtonInactive: {
    backgroundColor: '#1f2430',
  },
  autoPlayButtonActive: {
    backgroundColor: '#28a745',
  },
  autoPlayButtonInactive: {
    backgroundColor: '#1f2430',
  },
  animationFpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  animationFpsLabel: {
    color: '#8ea2d8',
    fontSize: 12,
  },
  animationFpsInput: {
    flex: 1,
    minWidth: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a3147',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#fff',
    backgroundColor: '#191f2e',
  },
  animationList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3147',
    backgroundColor: '#121623',
    maxHeight: 320,
  },
  animationListContent: {
    paddingVertical: 4,
  },
  animationListItem: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  animationListItemInner: {
    flex: 1,
    justifyContent: 'center',
  },
  animationListItemActive: {
    backgroundColor: '#28304b',
  },
  animationListItemText: {
    color: '#dee6ff',
    fontSize: 13,
  },
  timelineColumn: {
    flex: 1,
    minWidth: 320,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#dfe7ff',
    fontWeight: '600',
  },
  timelineToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  timelineButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 4,
  },
  resumeIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  resumeIconReverse: {
    flexDirection: 'row-reverse',
  },
  resumeIconBar: {
    width: 2,
    borderRadius: 1,
  },
  reverseIcon: {
    transform: [{ scaleX: -1 }],
  },
  timelineDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 0,
    marginRight: 8,
  },
  timelineScroll: {
    flexGrow: 1,
  },
  timelineContent: {
    flexDirection: 'row',
    paddingBottom: 6,
  },
  timelineCard: {
    width: TIMELINE_CARD_SIZE,
    height: TIMELINE_CARD_SIZE,
    padding: TIMELINE_CARD_PADDING,
    backgroundColor: '#141925',
  },
  timelineCardSelected: {
    backgroundColor: '#1c2441',
  },
  timelineCardBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCardFooter: {
    height: TIMELINE_FOOTER_HEIGHT,
    justifyContent: 'center',
  },
  thumb: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0f1321',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  thumbPlaceholderText: {
    color: '#6f7896',
    fontSize: 10,
  },
  timelineCardMeta: {
    color: '#a3acc7',
    fontSize: 12,
    textAlign: 'center',
  },
  multiplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  multiplierLabel: {
    color: '#7d86a0',
    fontSize: 11,
  },
  multiplierInput: {
    width: 64,
    textAlign: 'left',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b3246',
    color: '#fff',
    backgroundColor: '#191f2e',
  },
  multiplierInputDisabled: {
    opacity: 0.5,
  },
  multiplierUnit: {
    color: '#8a92ae',
    fontSize: 11,
  },
  emptyTimelineWrapper: {
    flex: 1,
    width: '100%',
    minHeight: TIMELINE_CARD_SIZE + TIMELINE_CARD_PADDING * 2,
  },
  timelineTrack: {
    width: '100%',
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22293a',
    backgroundColor: '#0f1321',
    padding: 12,
    minHeight: TIMELINE_CARD_SIZE + TIMELINE_CARD_PADDING * 2 + 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  framePickerWindow: {
    width: 980,
    height: 590,
    maxWidth: 1080,
    maxHeight: '96%',
    minWidth: 590,
    minHeight: 600,
  },
  framePickerContent: {
    flex: 1,
    minHeight: 780,
  },
});
