import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
import { PreviewPlayer } from './PreviewPlayer';
import { FrameGridSelector, type FrameGridCell } from './FrameGridSelector';
import type { EditorIntegration } from '../hooks/useEditorIntegration';

interface AnimationStudioProps {
  editor: SpriteEditorApi;
  integration: EditorIntegration;
  image: DataSourceParam;
}

const DEFAULT_DURATION = 80;
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

const getAnimationFps = (
  settings: AnimationSettingsMeta,
  name: string | undefined,
): number => {
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

export const AnimationStudio = ({ editor, integration, image }: AnimationStudioProps) => {
  const frames = editor.state.frames;
  const animations = editor.state.animations;
  const [thumbnailScale, setThumbnailScale] = useState(1);
  const [timelineClipboard, setTimelineClipboard] = useState<number[] | null>(null);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [timelineMeasuredHeight, setTimelineMeasuredHeight] = useState(0);
  const [timelineFilledHeight, setTimelineFilledHeight] = useState(0);
  const [isFramePickerVisible, setFramePickerVisible] = useState(false);
  const {
    activeAnimation,
    setActiveAnimation,
    playForward,
    playReverse,
    pause,
    stop,
    seekFrame,
    isPlaying,
    speedScale,
    setSpeedScale,
    frameCursor,
  } = integration;
  const multiplierFieldRef = useRef<MultiplierFieldHandle>(null);
  const commitPendingMultiplier = useCallback(() => {
    multiplierFieldRef.current?.commit();
  }, []);
  const setTimelineSelection = useCallback<
    React.Dispatch<React.SetStateAction<number | null>>
  >(
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
        <MaterialIcons
          name="play-arrow"
          size={size}
          color={color}
          style={styles.reverseIcon}
        />
      </View>
    ),
    [],
  );

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
        seekFrame(nextSequence[0], { cursor: 0, animationName: name });
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

  const animationNames = useMemo(() => Object.keys(animations), [animations]);
  const animationsMeta = editor.state.animationsMeta;

  useEffect(() => {
    if (!animationNames.length) {
      return;
    }
    if (!activeAnimation || !animationNames.includes(activeAnimation)) {
      setActiveAnimation(animationNames[0]);
    }
  }, [activeAnimation, animationNames, setActiveAnimation]);

  const currentAnimationName = activeAnimation ?? animationNames[0];
  const currentSequence = useMemo(
    () => (currentAnimationName ? (animations[currentAnimationName] ?? []) : []),
    [animations, currentAnimationName],
  );
  const animationSettings = useMemo(
    () => getAnimationSettings(editor.state.meta),
    [editor.state.meta],
  );
  const currentAnimationFps = getAnimationFps(animationSettings, currentAnimationName);
  const currentAnimationLoop = currentAnimationName
    ? animationsMeta[currentAnimationName]?.loop ?? true
    : true;
  const currentBaseDuration = fpsToDuration(currentAnimationFps);

  const lastAnimationRef = useRef<string | null>(null);
  useEffect(() => {
    const nextName = currentAnimationName ?? null;
    const nextSequence = nextName ? animations[nextName] ?? [] : [];
    const animationChanged = lastAnimationRef.current !== nextName;
    lastAnimationRef.current = nextName;

    if (!nextSequence.length) {
      setTimelineSelection(null);
      return;
    }

    if (animationChanged) {
      setTimelineSelection(() => 0);
      seekFrame(nextSequence[0], { cursor: 0, animationName: nextName });
      return;
    }

    setTimelineSelection((prev) => {
      if (prev === null || prev >= nextSequence.length) {
        return 0;
      }
      return prev;
    });
  }, [
    animations,
    currentAnimationName,
    seekFrame,
    setTimelineSelection,
  ]);

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
      const settings = getAnimationSettings(editor.state.meta);
      const nextSettings: AnimationSettingsMeta = {
        ...settings,
        fps: { ...(settings.fps ?? {}), [name]: fps },
      };
      editor.updateMeta({
        animationSettings: nextSettings,
      });
    },
    [editor],
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
    (next: number[]) => {
      if (!currentAnimationName) {
        return;
      }
      editor.setAnimations({
        ...animations,
        [currentAnimationName]: next,
      });
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
        const frame = editor.addFrame({
          x: cell.x,
          y: cell.y,
          w: cell.width,
          h: cell.height,
          duration: currentBaseDuration,
        });
        newIndexes.push(startIndex + idx);
        updateAnimationMultiplierMeta(currentAnimationName ?? '', startIndex + idx, 1);
      });
      updateSequence([...currentSequence, ...newIndexes]);
    },
    [
      currentAnimationName,
      currentBaseDuration,
      currentSequence,
      editor,
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

  const handleStartRename = () => {
    if (!currentAnimationName) {
      return;
    }
    setRenameDraft(currentAnimationName);
    setRenameError(null);
    setIsRenaming(true);
  };

  const handleRenameConfirm = () => {
    if (!currentAnimationName) {
      return;
    }
    const nextName = renameDraft.trim();
    if (!nextName.length) {
      setRenameError('名前を入力してください');
      return;
    }
    if (nextName !== currentAnimationName && animations[nextName]) {
      setRenameError('同名のアニメーションが存在します');
      return;
    }
    if (nextName === currentAnimationName) {
      setIsRenaming(false);
      setRenameError(null);
      return;
    }
    const nextAnimations = { ...animations, [nextName]: animations[currentAnimationName] };
    delete nextAnimations[currentAnimationName];
    editor.setAnimations(nextAnimations);
    setActiveAnimation(nextName);
    setIsRenaming(false);
    setRenameError(null);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameError(null);
  };

  const handleDeleteAnimation = useCallback(
    (name: string) => {
      const next = { ...animations };
      delete next[name];
      editor.setAnimations(next);
      const settings = getAnimationSettings(editor.state.meta);
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
    [activeAnimation, animations, animationsMeta, editor, editor.state.meta, setActiveAnimation],
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

  const confirmDeleteAnimation = useCallback(
    (name: string) => {
      Alert.alert('確認', 'アニメーションを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => handleDeleteAnimation(name) },
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
    setTimelineSelection(targetIndex);
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

  const selectedMultiplier = useMemo(() => {
    if (currentAnimationName && selectedTimelineIndex !== null) {
      const stored =
        animationSettings.multipliers?.[currentAnimationName]?.[selectedTimelineIndex];
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
      const settings = getAnimationSettings(editor.state.meta);
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
    [editor],
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
      selectedTimelineIndex,
      updateAnimationMultiplierMeta,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Animation Studio</Text>
      </View>
      {isRenaming && currentAnimationName && (
        <View style={styles.renameRow}>
          <Text style={styles.renameLabel}>名称変更</Text>
          <TextInput
            style={styles.renameInput}
            value={renameDraft}
            onChangeText={setRenameDraft}
            autoFocus
            onSubmitEditing={handleRenameConfirm}
          />
          <IconButton
            name="check"
            onPress={handleRenameConfirm}
            accessibilityLabel="Confirm rename"
          />
          <IconButton name="close" onPress={handleRenameCancel} accessibilityLabel="Cancel rename" />
        </View>
      )}
      {renameError && <Text style={styles.renameError}>{renameError}</Text>}
      <View style={styles.previewSection}>
        <PreviewPlayer integration={integration} image={image} />
      </View>
      <View style={styles.body}>
        <View style={animationColumnStyle}>
          <Text style={styles.sectionTitle}>Animations</Text>
          <View style={styles.animationToolbar}>
            <IconButton
              name="edit"
              onPress={handleStartRename}
              disabled={!currentAnimationName}
              accessibilityLabel="Rename animation"
            />
            <IconButton name="add" onPress={handleAddAnimation} accessibilityLabel="Add animation" />
            <IconButton
              name="delete"
              onPress={() => currentAnimationName && confirmDeleteAnimation(currentAnimationName)}
              disabled={
                !currentAnimationName
              }
              accessibilityLabel="Delete animation"
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
          <ScrollView style={styles.animationList} contentContainerStyle={styles.animationListContent}>
            {animationNames.map((name) => (
              <TouchableOpacity
                key={name}
                style={[
                  styles.animationListItem,
                  currentAnimationName === name && styles.animationListItemActive,
                ]}
                onPress={() => handleSelectAnimationItem(name)}
              >
                <Text style={styles.animationListItemText}>{name}</Text>
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
                onPress={() => playReverse(currentAnimationName)}
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
                  playReverse(currentAnimationName);
                }}
                disabled={currentSequence.length === 0}
                accessibilityLabel="Restart animation in reverse from beginning"
              />
              <IconButton
                iconFamily="material"
                name={isPlaying ? 'pause' : 'stop'}
                onPress={() => (isPlaying ? pause() : stop())}
                accessibilityLabel={isPlaying ? 'Pause animation preview' : 'Stop animation preview'}
              />
              <IconButton
                renderIcon={renderResumeForwardIcon}
                onPress={() => {
                  if (!currentSequence.length) {
                    return;
                  }
                  stop();
                  playForward(currentAnimationName);
                }}
                disabled={currentSequence.length === 0}
                accessibilityLabel="Restart animation from beginning"
              />
              <IconButton
                iconFamily="material"
                name="play-arrow"
                onPress={() => playForward(currentAnimationName)}
                disabled={isPlaying || currentSequence.length === 0}
                accessibilityLabel="Play animation preview"
              />
              <View style={styles.timelineDivider} />
              <IconButton
                name="grid-on"
                onPress={() => setFramePickerVisible(true)}
                accessibilityLabel="Open frame picker modal"
              />
              <View style={styles.timelineDivider} />
              <IconButton
                name="content-copy"
                onPress={handleCopyTimelineFrame}
                disabled={selectedTimelineIndex === null}
                accessibilityLabel="Copy timeline frame"
              />
              <IconButton
                name="content-paste"
                onPress={handlePasteTimelineFrame}
                disabled={!timelineClipboard?.length}
                accessibilityLabel="Paste timeline frame"
              />
              <View style={styles.timelineDivider} />
              <IconButton
                name="skip-previous"
                onPress={() => handleMoveTimelineFrame(-1)}
                disabled={selectedTimelineIndex === null || selectedTimelineIndex === 0}
                accessibilityLabel="Move frame left"
              />
              <IconButton
                name="skip-next"
                onPress={() => handleMoveTimelineFrame(1)}
                disabled={
                  selectedTimelineIndex === null ||
                  selectedTimelineIndex === currentSequence.length - 1 ||
                  currentSequence.length === 0
                }
                accessibilityLabel="Move frame right"
              />
              <IconButton
                name="delete-forever"
                onPress={handleRemoveTimelineFrame}
                disabled={selectedTimelineIndex === null}
                accessibilityLabel="Remove timeline frame"
              />
            </View>
            <View style={styles.timelineDivider} />
            <MultiplierField
              ref={multiplierFieldRef}
              value={selectedMultiplier}
              disabled={!selectedFrame}
              onSubmit={handleMultiplierSubmit}
            />
          </View>
          <ScrollView
            horizontal
            style={styles.timelineScroll}
            contentContainerStyle={styles.timelineContent}
            showsHorizontalScrollIndicator={false}
          >
            {!sequenceCards.length && (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyTimelineText}>タイムラインにフレームがありません。</Text>
                <Text style={styles.emptyTimelineSubText}>
                  下部のフレームピッカーからマスをタップして追加してください。
                </Text>
              </View>
            )}
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
                  onPress={() => {
                    setTimelineSelection(timelineIndex);
                    seekFrame(frameIndex, {
                      cursor: timelineIndex,
                      animationName: currentAnimationName ?? null,
                    });
                  }}
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
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
      <Modal
        animationType="slide"
        transparent
        visible={isFramePickerVisible}
        onRequestClose={() => setFramePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Frame Picker</Text>
              <IconButton name="close" onPress={() => setFramePickerVisible(false)} accessibilityLabel="Close frame picker" />
            </View>
            <FrameGridSelector
              image={{ source: image }}
              onAddFrames={(cells) => {
                handleGridAddFrames(cells);
                setFramePickerVisible(false);
              }}
            />
          </View>
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
      if (!Number.isNaN(parsed)) {
        onSubmit(parsed);
      } else {
        setText(value.toFixed(2));
      }
    }, [disabled, onSubmit, text, value]);

    useImperativeHandle(ref, () => ({
      commit,
    }));

    useEffect(() => {
      setText(value.toFixed(2));
    }, [value, disabled]);

    return (
      <View style={styles.multiplierRow}>
        <Text style={styles.multiplierLabel}>倍率</Text>
        <TextInput
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
      <TextInput
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
    if ('uri' in (value as Record<string, unknown>) && typeof (value as { uri?: string }).uri === 'string') {
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
  },
  title: {
    color: '#f1f5ff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  renameLabel: {
    color: '#cfd7f3',
    fontSize: 12,
  },
  renameInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2f3850',
    color: '#fff',
    backgroundColor: '#191f2d',
  },
  renameError: {
    marginTop: 4,
    color: '#ff6b6b',
    fontSize: 11,
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
  body: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    marginTop: 12,
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
  emptyTimeline: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22293a',
    backgroundColor: '#141925',
  },
  emptyTimelineText: {
    color: '#d7def5',
    fontWeight: '600',
  },
  emptyTimelineSubText: {
    color: '#a0aac5',
    marginTop: 4,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0f1421',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2436',
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#f2f6ff',
    fontSize: 16,
    fontWeight: '600',
  },
});
