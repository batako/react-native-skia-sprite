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
import {
  saveSprite,
  type SpriteAnimationMeta,
  type SpriteAnimationsMeta,
  type SpriteEditorApi,
  type SpriteEditorFrame,
  type SpriteSummary,
} from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { MaterialIcons } from '@expo/vector-icons';
import { IconButton, type IconButtonRenderIconProps } from './IconButton';
import { MacWindow, type MacWindowVariant } from './MacWindow';
import { PreviewPlayer } from './PreviewPlayer';
import {
  FrameGridSelector,
  type FrameGridCell,
  type FrameGridImageDescriptor,
} from './FrameGridSelector';
import { SelectableTextInput } from './SelectableTextInput';
import type { EditorIntegration } from '../hooks/useEditorIntegration';
import { FileBrowserModal } from './FileBrowserModal';
import { StoragePanel } from './StoragePanel';

interface AnimationStudioProps {
  editor: SpriteEditorApi;
  integration: EditorIntegration;
  image: DataSourceParam;
}

const DEFAULT_ANIMATION_FPS = 5;
const MIN_ANIMATION_FPS = 1;
const MAX_ANIMATION_FPS = 60;
const TIMELINE_CARD_SIZE = 150;
const TIMELINE_CARD_PADDING = 10;
const TIMELINE_FOOTER_HEIGHT = 28;
const DEFAULT_FRAME_MULTIPLIER = 1;
const MIN_FRAME_MULTIPLIER = 0.1;
const MULTIPLIER_EPSILON = 0.0001;

type LegacyAnimationSettingsMeta = {
  fps?: Record<string, number>;
  multipliers?: Record<string, Record<number, number>>;
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

const clampMultiplier = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_FRAME_MULTIPLIER;
  }
  return Math.max(MIN_FRAME_MULTIPLIER, value);
};

const normalizeMultipliersArray = (values: number[], targetLength?: number): number[] => {
  const length = targetLength ?? values.length;
  const normalized = new Array(length);
  for (let i = 0; i < length; i += 1) {
    const raw = i < values.length ? values[i]! : DEFAULT_FRAME_MULTIPLIER;
    normalized[i] = clampMultiplier(raw);
  }
  return normalized;
};

const multipliersEqual = (a: number[] | undefined, b: number[]) => {
  if (!a) {
    return b.every((value) => Math.abs(value - DEFAULT_FRAME_MULTIPLIER) < MULTIPLIER_EPSILON);
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i]! - b[i]!) > MULTIPLIER_EPSILON) {
      return false;
    }
  }
  return true;
};

const animationMetaEquals = (a?: SpriteAnimationMeta, b?: SpriteAnimationMeta) => {
  if (!a || !b) {
    return false;
  }
  if (
    a.loop !== b.loop ||
    clampFps(a.fps ?? DEFAULT_ANIMATION_FPS) !== clampFps(b.fps ?? DEFAULT_ANIMATION_FPS)
  ) {
    return false;
  }
  return multipliersEqual(a.multipliers, b.multipliers ?? []);
};

const normalizeAnimationMetaEntry = (
  entry: SpriteAnimationMeta | undefined,
  sequenceLength: number,
): SpriteAnimationMeta => {
  const normalized: SpriteAnimationMeta = {};
  if (typeof entry?.loop === 'boolean') {
    normalized.loop = entry.loop;
  }
  normalized.fps = clampFps(entry?.fps ?? DEFAULT_ANIMATION_FPS);
  normalized.multipliers = normalizeMultipliersArray(
    Array.isArray(entry?.multipliers) ? entry.multipliers : [],
    sequenceLength,
  );
  return normalized;
};

const createAnimationMetaDraft = (
  entry: SpriteAnimationMeta | undefined,
  sequenceLength: number,
): SpriteAnimationMeta => {
  const normalized = normalizeAnimationMetaEntry(entry, sequenceLength);
  return {
    ...normalized,
    multipliers: normalized.multipliers ? normalized.multipliers.slice() : [],
  };
};

const cleanupAnimationMetaEntry = (
  entry: SpriteAnimationMeta,
  sequenceLength: number,
): SpriteAnimationMeta => normalizeAnimationMetaEntry(entry, sequenceLength);

export const AnimationStudio = ({ editor, integration, image }: AnimationStudioProps) => {
  const frames = editor.state.frames;
  const animations = useMemo(() => editor.state.animations ?? {}, [editor.state.animations]);
  const animationsMeta = useMemo(
    () => editor.state.animationsMeta ?? {},
    [editor.state.animationsMeta],
  );
  const legacySettingsMigratedRef = useRef(false);
  const [timelineClipboard, setTimelineClipboard] = useState<number[] | null>(null);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number | null>(null);
  const [renamingAnimation, setRenamingAnimation] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [timelineMeasuredHeight, setTimelineMeasuredHeight] = useState(0);
  const [timelineFilledHeight, setTimelineFilledHeight] = useState(0);
  const [isFramePickerVisible, setFramePickerVisible] = useState(false);
  const [framePickerVariant, setFramePickerVariant] = useState<MacWindowVariant>('default');
  const [isStorageManagerVisible, setStorageManagerVisible] = useState(false);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [lastStoredSummary, setLastStoredSummary] = useState<SpriteSummary | null>(null);

  useEffect(() => {
    if (!fileActionMessage) {
      return;
    }
    const timer = setTimeout(() => {
      setFileActionMessage(null);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [fileActionMessage]);
  const [isFrameSourceBrowserVisible, setFrameSourceBrowserVisible] = useState(false);
  const [framePickerImage, setFramePickerImage] = useState<FrameGridImageDescriptor | null>(null);
  const [frameImageInfos, setFrameImageInfos] = useState<
    Record<string, { width: number; height: number; ready: boolean }>
  >({});
  const frameImageInfosRef = useRef(frameImageInfos);
  useEffect(() => {
    frameImageInfosRef.current = frameImageInfos;
  }, [frameImageInfos]);
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

  const updateAnimationMetaEntry = useCallback(
    (name: string, mutator: (draft: SpriteAnimationMeta) => void) => {
      if (!name) {
        return;
      }
      const sequenceLength = animations[name]?.length ?? 0;
      const draft: SpriteAnimationMeta = createAnimationMetaDraft(
        animationsMeta[name],
        sequenceLength,
      );
      mutator(draft);
      const cleaned = cleanupAnimationMetaEntry(draft, sequenceLength);
      const prevEntry = animationsMeta[name];
      if (prevEntry && animationMetaEquals(prevEntry, cleaned)) {
        return;
      }
      editor.setAnimationsMeta({
        ...animationsMeta,
        [name]: cleaned,
      });
    },
    [animations, animationsMeta, editor],
  );

  const setAnimationMultipliers = useCallback(
    (name: string, values: number[]) => {
      const sequenceLength = animations[name]?.length ?? values.length;
      const normalized = normalizeMultipliersArray(values, sequenceLength);
      updateAnimationMetaEntry(name, (draft) => {
        if (multipliersEqual(draft.multipliers, normalized)) {
          return;
        }
        draft.multipliers = normalized.slice();
      });
    },
    [animations, updateAnimationMetaEntry],
  );

  useEffect(() => {
    if (legacySettingsMigratedRef.current) {
      return;
    }
    const legacySettings = (
      editor.state.meta as { animationSettings?: LegacyAnimationSettingsMeta }
    )?.animationSettings;
    if (!legacySettings) {
      legacySettingsMigratedRef.current = true;
      return;
    }
    const hasLegacyFps = legacySettings.fps && Object.keys(legacySettings.fps).length > 0;
    const hasLegacyMultipliers =
      legacySettings.multipliers && Object.keys(legacySettings.multipliers).length > 0;
    if (!hasLegacyFps && !hasLegacyMultipliers) {
      editor.updateMeta((prevMeta) => {
        if (!prevMeta?.animationSettings) {
          return prevMeta;
        }
        const { animationSettings, ...rest } = prevMeta;
        return rest;
      });
      legacySettingsMigratedRef.current = true;
      return;
    }
    const nextMeta = { ...animationsMeta };
    if (legacySettings.fps) {
      Object.entries(legacySettings.fps).forEach(([name, value]) => {
        if (!Number.isFinite(value)) {
          return;
        }
        const clamped = clampFps(value);
        if (!nextMeta[name]) {
          nextMeta[name] = {};
        }
        if (clamped !== DEFAULT_ANIMATION_FPS) {
          nextMeta[name]!.fps = clamped;
        }
      });
    }
    if (legacySettings.multipliers) {
      Object.entries(legacySettings.multipliers).forEach(([name, record]) => {
        if (!record) {
          return;
        }
        const entries = Object.entries(record)
          .map(([index, multiplier]) => ({ index: Number(index), multiplier }))
          .filter(({ index }) => Number.isFinite(index) && index >= 0);
        if (!entries.length) {
          return;
        }
        const maxIndex = entries.reduce((max, { index }) => Math.max(max, index), -1);
        const values = new Array(maxIndex + 1).fill(DEFAULT_FRAME_MULTIPLIER);
        entries.forEach(({ index, multiplier }) => {
          if (Number.isFinite(multiplier)) {
            values[index] = clampMultiplier(multiplier);
          }
        });
        if (!nextMeta[name]) {
          nextMeta[name] = {};
        }
        nextMeta[name]!.multipliers = normalizeMultipliersArray(values);
      });
    }
    editor.setAnimationsMeta(nextMeta);
    editor.updateMeta((prevMeta) => {
      if (!prevMeta?.animationSettings) {
        return prevMeta;
      }
      const { animationSettings, ...rest } = prevMeta;
      return rest;
    });
    legacySettingsMigratedRef.current = true;
  }, [animationsMeta, editor, editor.state.meta]);

  const handleOpenStorageManager = useCallback(() => {
    setStorageManagerVisible(true);
  }, []);

  const handleCloseStorageManager = useCallback(() => {
    setStorageManagerVisible(false);
  }, []);

  const handleStorageSaved = useCallback((summary: SpriteSummary) => {
    setLastStoredSummary(summary);
    setFileActionMessage(`Saved ${summary.displayName}`);
  }, []);

  const handleStorageLoaded = useCallback(
    (summary: SpriteSummary) => {
      setLastStoredSummary(summary);
      setFileActionMessage(`Loaded ${summary.displayName}`);
      handleCloseStorageManager();
    },
    [handleCloseStorageManager],
  );

  const handleQuickSave = useCallback(async () => {
    if (isQuickSaving) {
      return;
    }
    if (!editor.state.frames.length) {
      setFileActionMessage('Add at least one frame before saving.');
      return;
    }
    const displayName = (editor.state.meta?.displayName ?? '').trim();
    if (!displayName.length) {
      setFileActionMessage('Set a sprite name in the Meta panel before saving.');
      setStorageManagerVisible(true);
      return;
    }
    if (!lastStoredSummary) {
      setFileActionMessage('Use "Save as" to create a storage entry first.');
      setStorageManagerVisible(true);
      return;
    }
    setIsQuickSaving(true);
    try {
      const payload = editor.exportJSON();
      const now = Date.now();
      const stored = await saveSprite({
        sprite: {
          ...payload,
          id: lastStoredSummary.id,
          meta: {
            ...(payload.meta ?? {}),
            displayName,
            createdAt: lastStoredSummary.createdAt,
            updatedAt: now,
          },
        },
      });
      const summary: SpriteSummary = {
        id: stored.id,
        displayName: stored.meta.displayName,
        createdAt: stored.meta.createdAt,
        updatedAt: stored.meta.updatedAt,
      };
      setLastStoredSummary(summary);
      setFileActionMessage(`Saved ${summary.displayName}`);
    } catch (error) {
      setFileActionMessage((error as Error).message);
    } finally {
      setIsQuickSaving(false);
    }
  }, [editor, isQuickSaving, lastStoredSummary]);

  const autoPlayAnimationName = editor.state.autoPlayAnimation ?? null;

  const renderRestartForwardIcon = useCallback(
    ({ color, size }: IconButtonRenderIconProps) => (
      <View style={styles.restartIcon}>
        <View style={[styles.restartIconBar, { backgroundColor: color, height: size }]} />
        <MaterialIcons name="play-arrow" size={size} color={color} />
      </View>
    ),
    [],
  );

  const renderRestartReverseIcon = useCallback(
    ({ color, size }: IconButtonRenderIconProps) => (
      <View style={[styles.restartIcon, styles.restartIconReverse]}>
        <View style={[styles.restartIconBar, { backgroundColor: color, height: size }]} />
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
      const nextAnimationsMeta = renameRecordKey(animationsMeta, renamingAnimation, nextName);
      editor.setAnimationsMeta(nextAnimationsMeta);
      if (autoPlayAnimationName === renamingAnimation) {
        editor.setAutoPlayAnimation(nextName);
      }
      setActiveAnimation(nextName);
    }
    cancelRename();
  }, [
    animations,
    animationsMeta,
    cancelRename,
    editor,
    renamingAnimation,
    renameDraft,
    setActiveAnimation,
    autoPlayAnimationName,
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
    let changed = false;
    const nextMeta: SpriteAnimationsMeta = { ...animationsMeta };
    animationNames.forEach((name) => {
      const sequenceLength = animations[name]?.length ?? 0;
      const normalized = normalizeAnimationMetaEntry(animationsMeta[name], sequenceLength);
      const prevEntry = animationsMeta[name];
      if (!prevEntry || !animationMetaEquals(prevEntry, normalized)) {
        nextMeta[name] = normalized;
        changed = true;
      }
    });
    Object.keys(nextMeta).forEach((name) => {
      if (!animations[name]) {
        delete nextMeta[name];
        changed = true;
      }
    });
    if (changed) {
      editor.setAnimationsMeta(nextMeta);
    }
  }, [animationNames, animations, animationsMeta, editor]);

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
  const currentAnimationFps = currentAnimationName
    ? clampFps(animationsMeta[currentAnimationName]?.fps ?? DEFAULT_ANIMATION_FPS)
    : DEFAULT_ANIMATION_FPS;
  const currentAnimationLoop = currentAnimationName
    ? (animationsMeta[currentAnimationName]?.loop ?? true)
    : true;

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
  const frameImageUris = useMemo(() => {
    const unique = new Set<string>();
    editor.state.frames.forEach((frame) => {
      if (frame.imageUri) {
        unique.add(frame.imageUri);
      }
    });
    return Array.from(unique);
  }, [editor.state.frames]);

  useEffect(() => {
    const known = frameImageInfosRef.current;
    const pending = frameImageUris.filter((uri) => uri && !known[uri]);
    if (!pending.length) {
      return;
    }
    let cancelled = false;
    pending.forEach((uri) => {
      Image.getSize(
        uri,
        (width, height) => {
          if (cancelled) {
            return;
          }
          if (cancelled) {
            return;
          }
          setFrameImageInfos((prev) => {
            if (prev[uri]) {
              return prev;
            }
            const next = {
              ...prev,
              [uri]: { width, height, ready: true },
            };
            frameImageInfosRef.current = next;
            return next;
          });
        },
        () => {
          if (cancelled) {
            return;
          }
          setFrameImageInfos((prev) => {
            if (prev[uri]) {
              return prev;
            }
            const next = {
              ...prev,
              [uri]: { width: 0, height: 0, ready: false },
            };
            frameImageInfosRef.current = next;
            return next;
          });
        },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [frameImageUris]);
  const handleAnimationFpsChange = useCallback(
    (nextFps: number) => {
      if (!currentAnimationName) {
        return;
      }
      const clamped = clampFps(nextFps);
      updateAnimationMetaEntry(currentAnimationName, (draft) => {
        draft.fps = clamped;
      });
    },
    [currentAnimationName, updateAnimationMetaEntry],
  );

  const updateSequence = useCallback(
    (
      next: number[] | ((prev: number[]) => number[]),
      multipliersUpdater?: (prev: number[]) => number[],
    ): number[] => {
      if (!currentAnimationName) {
        return [];
      }
      const prevSequence = animations[currentAnimationName] ?? [];
      const nextSequence = typeof next === 'function' ? next(prevSequence) : next;
      editor.setAnimations({
        ...animations,
        [currentAnimationName]: nextSequence,
      });
      const prevMultipliers = animationsMeta[currentAnimationName]?.multipliers ?? [];
      let nextMultipliersArray: number[] | null = null;
      if (multipliersUpdater) {
        nextMultipliersArray = multipliersUpdater(prevMultipliers);
      } else if (prevMultipliers.length > nextSequence.length) {
        nextMultipliersArray = prevMultipliers.slice(0, nextSequence.length);
      }
      if (multipliersUpdater) {
        setAnimationMultipliers(currentAnimationName, nextMultipliersArray ?? prevMultipliers);
      } else if (nextMultipliersArray) {
        setAnimationMultipliers(currentAnimationName, nextMultipliersArray);
      }
      return nextSequence;
    },
    [animations, animationsMeta, currentAnimationName, editor, setAnimationMultipliers],
  );

  const resolveFrameImageUri = useCallback((descriptor?: FrameGridImageDescriptor | null) => {
    if (!descriptor?.source) {
      return undefined;
    }
    const source = descriptor.source as DataSourceParam;
    if (typeof source === 'string') {
      return source;
    }
    if (typeof source === 'number') {
      return undefined;
    }
    if ('uri' in (source as Record<string, unknown>)) {
      const uriValue = (source as { uri?: string }).uri;
      if (uriValue) {
        return uriValue;
      }
    }
    return undefined;
  }, []);

  const handleGridAddFrames = useCallback(
    (cells: FrameGridCell[], sourceImage?: FrameGridImageDescriptor) => {
      if (!cells.length) {
        return;
      }
      const previousAnimation = currentAnimationName;
      const previousTimelineIndex = selectedTimelineIndex;

      // Clear selection before inserting frames; keeping the previous selection active while frames are appended causes the timeline state to toggle rapidly
      setActiveAnimation(null);
      setTimelineSelection(null);

      const resolvedImageUri = resolveFrameImageUri(sourceImage);
      const startIndex = editor.state.frames.length;
      const newIndexes: number[] = [];
      cells.forEach((cell, idx) => {
        editor.addFrame({
          x: cell.x,
          y: cell.y,
          w: cell.width,
          h: cell.height,
          duration: undefined,
          imageUri: resolvedImageUri,
        });
        newIndexes.push(startIndex + idx);
      });
      const nextSequence = updateSequence(
        (prevSequence) => [...prevSequence, ...newIndexes],
        (prevMultipliers) => {
          const result = prevMultipliers.slice();
          for (let i = 0; i < newIndexes.length; i += 1) {
            result.push(DEFAULT_FRAME_MULTIPLIER);
          }
          return result;
        },
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (previousAnimation) {
            setActiveAnimation(previousAnimation);
          }
          if (previousTimelineIndex !== null && nextSequence.length) {
            const clamped = Math.max(0, Math.min(nextSequence.length - 1, previousTimelineIndex));
            setTimelineSelection(clamped);
          }
        });
      });
    },
    [
      currentAnimationName,
      editor,
      selectedTimelineIndex,
      resolveFrameImageUri,
      setActiveAnimation,
      setTimelineSelection,
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
      const nextAnimationsMeta = { ...animationsMeta };
      delete nextAnimationsMeta[name];
      editor.setAnimationsMeta(nextAnimationsMeta);
      if (autoPlayAnimationName === name) {
        editor.setAutoPlayAnimation(null);
      }
      if (activeAnimation === name) {
        const remaining = Object.keys(next);
        setActiveAnimation(remaining.length ? remaining[0] : null);
      }
    },
    [
      activeAnimation,
      animations,
      animationsMeta,
      editor,
      autoPlayAnimationName,
      setActiveAnimation,
    ],
  );

  const handleToggleAnimationLoop = useCallback(() => {
    if (!currentAnimationName) {
      return;
    }
    const currentFrame = frameCursor;
    updateAnimationMetaEntry(currentAnimationName, (draft) => {
      draft.loop = !currentAnimationLoop;
    });
    if (!isPlaying) {
      requestAnimationFrame(() => seekFrame(currentFrame));
    }
  }, [
    currentAnimationLoop,
    currentAnimationName,
    frameCursor,
    isPlaying,
    seekFrame,
    updateAnimationMetaEntry,
  ]);

  const handleSelectAutoPlayAnimation = useCallback(
    (targetName: string | null) => {
      editor.setAutoPlayAnimation(targetName);
    },
    [editor],
  );

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
    updateSequence(next, (prevMultipliers) => {
      const result = prevMultipliers.slice();
      const filler = new Array(timelineClipboard.length).fill(DEFAULT_FRAME_MULTIPLIER);
      result.splice(insertIndex, 0, ...filler);
      return result;
    });
    setTimelineSelection(insertIndex);
  };

  const handleRemoveTimelineFrame = () => {
    if (selectedTimelineIndex === null) {
      return;
    }
    const next = [...currentSequence];
    next.splice(selectedTimelineIndex, 1);
    updateSequence(next, (prevMultipliers) => {
      const result = prevMultipliers.slice();
      result.splice(selectedTimelineIndex, 1);
      return result;
    });
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
    updateSequence(next, (prevMultipliers) => {
      const result = prevMultipliers.slice();
      const value = result[selectedTimelineIndex] ?? DEFAULT_FRAME_MULTIPLIER;
      result.splice(selectedTimelineIndex, 1);
      result.splice(targetIndex, 0, value);
      return result;
    });
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
      const stored = animationsMeta[currentAnimationName]?.multipliers?.[selectedTimelineIndex];
      if (typeof stored === 'number') {
        return stored;
      }
    }
    return DEFAULT_FRAME_MULTIPLIER;
  }, [animationsMeta, currentAnimationName, selectedTimelineIndex]);

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

  const handleMultiplierSubmit = useCallback(
    (multiplier: number) => {
      if (!currentAnimationName || selectedTimelineIndex === null) {
        return;
      }
      const safeMultiplier = clampMultiplier(multiplier);
      const existing = animationsMeta[currentAnimationName]?.multipliers ?? [];
      const prevStored = existing[selectedTimelineIndex];
      if (
        typeof prevStored !== 'number' &&
        Math.abs(safeMultiplier - DEFAULT_FRAME_MULTIPLIER) < MULTIPLIER_EPSILON
      ) {
        return;
      }
      if (
        typeof prevStored === 'number' &&
        Math.abs(prevStored - safeMultiplier) < MULTIPLIER_EPSILON
      ) {
        return;
      }
      updateAnimationMetaEntry(currentAnimationName, (draft) => {
        const next = [...(draft.multipliers ?? [])];
        for (let i = next.length; i <= selectedTimelineIndex; i += 1) {
          next[i] = DEFAULT_FRAME_MULTIPLIER;
        }
        next[selectedTimelineIndex] = safeMultiplier;
        draft.multipliers = normalizeMultipliersArray(next);
      });
    },
    [animationsMeta, currentAnimationName, selectedTimelineIndex, updateAnimationMetaEntry],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Animation Studio</Text>
      </View>
      <View style={styles.fileControlsBar}>
        <TouchableOpacity
          style={[styles.fileButton, isQuickSaving && styles.fileButtonDisabled]}
          onPress={handleQuickSave}
          disabled={isQuickSaving}
        >
          <MaterialIcons name="save" size={18} color="#f6f8ff" />
          <Text style={styles.fileButtonText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fileButton}
          onPress={handleOpenStorageManager}
          accessibilityLabel="Save as new sprite"
        >
          <MaterialIcons name="save-alt" size={18} color="#f6f8ff" />
          <Text style={styles.fileButtonText}>Save As</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fileButton}
          onPress={handleOpenStorageManager}
          accessibilityLabel="Open storage manager"
        >
          <MaterialIcons name="folder-open" size={18} color="#f6f8ff" />
          <Text style={styles.fileButtonText}>Manage</Text>
        </TouchableOpacity>
      </View>
      {fileActionMessage ? <Text style={styles.fileStatus}>{fileActionMessage}</Text> : null}
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
                name="repeat"
                onPress={handleToggleAnimationLoop}
                disabled={!currentAnimationName}
                style={[currentAnimationLoop ? styles.loopButtonActive : styles.loopButtonInactive]}
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
                    <TouchableOpacity
                      onPress={() =>
                        handleSelectAutoPlayAnimation(autoPlayAnimationName === name ? null : name)
                      }
                      accessibilityLabel={
                        autoPlayAnimationName === name
                          ? 'Disable autoplay for this animation'
                          : 'Enable autoplay for this animation'
                      }
                      style={styles.autoPlayIndicatorButton}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <MaterialIcons
                        name={
                          autoPlayAnimationName === name ? 'play-circle' : 'play-circle-outline'
                        }
                        size={20}
                        color={autoPlayAnimationName === name ? '#f6c343' : '#4d5878'}
                      />
                    </TouchableOpacity>
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
                  renderIcon={renderRestartReverseIcon}
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
                  renderIcon={renderRestartForwardIcon}
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
                  onPress={() => setFrameSourceBrowserVisible(true)}
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
                        ? animationsMeta[currentAnimationName]?.multipliers?.[timelineIndex]
                        : undefined;
                    const computedMultiplier =
                      typeof storedMultiplier === 'number'
                        ? storedMultiplier
                        : DEFAULT_FRAME_MULTIPLIER;
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
                          {(() => {
                            if (!frame) {
                              return (
                                <View
                                  style={[
                                    styles.thumb,
                                    styles.thumbPlaceholder,
                                    { width: viewportSize, height: viewportSize },
                                  ]}
                                >
                                  <Text style={styles.thumbPlaceholderText}>No Image</Text>
                                </View>
                              );
                            }
                            const frameSource = frame.imageUri
                              ? { uri: frame.imageUri }
                              : timelineImageSource;
                            const frameInfo = frame.imageUri
                              ? frameImageInfos[frame.imageUri]
                              : imageInfo;
                            if (!frameSource || !frameInfo || !frameInfo.ready) {
                              return (
                                <View
                                  style={[
                                    styles.thumb,
                                    styles.thumbPlaceholder,
                                    { width: viewportSize, height: viewportSize },
                                  ]}
                                >
                                  <Text style={styles.thumbPlaceholderText}>No Image</Text>
                                </View>
                              );
                            }
                            const info = frameInfo;
                            return (
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
                                    source={frameSource}
                                    resizeMode="cover"
                                    style={{
                                      width: (info.width || frame.w) * frameScale,
                                      height: (info.height || frame.h) * frameScale,
                                      transform: [
                                        { translateX: -frame.x * frameScale },
                                        { translateY: -frame.y * frameScale },
                                      ],
                                    }}
                                  />
                                </View>
                              </View>
                            );
                          })()}
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
          setFramePickerImage(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <MacWindow
            title="Frame Picker"
            onVariantChange={setFramePickerVariant}
            onClose={() => {
              setFramePickerVariant('default');
              setFramePickerVisible(false);
              setFramePickerImage(null);
            }}
            enableCompact={false}
            style={framePickerVariant === 'default' ? styles.framePickerWindow : undefined}
            contentStyle={styles.framePickerContent}
          >
            <FrameGridSelector
              image={framePickerImage ?? undefined}
              emptyMessage="Select an image from the file browser to begin slicing."
              onAddFrames={(cells, descriptor) => {
                handleGridAddFrames(cells, descriptor ?? framePickerImage ?? undefined);
                setFramePickerVisible(false);
                setFramePickerImage(null);
              }}
            />
          </MacWindow>
        </View>
      </Modal>
      <FileBrowserModal
        visible={isFrameSourceBrowserVisible}
        onClose={() => setFrameSourceBrowserVisible(false)}
        onOpenFile={(uri) => {
          setFrameSourceBrowserVisible(false);
          setFramePickerVariant('default');
          setFramePickerImage({ source: { uri }, name: uri.split('/').pop() ?? uri });
          setFramePickerVisible(true);
        }}
        allowedMimeTypes={['image/*']}
      />
      <StoragePanel
        editor={editor}
        visible={isStorageManagerVisible}
        onClose={handleCloseStorageManager}
        onSpriteLoaded={handleStorageLoaded}
        onSpriteSaved={handleStorageSaved}
      />
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
  fileControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1b2234',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fileButtonDisabled: {
    opacity: 0.6,
  },
  fileButtonText: {
    color: '#f6f8ff',
    fontWeight: '600',
    fontSize: 13,
  },
  fileStatus: {
    color: '#8fb3ff',
    fontSize: 12,
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
  animationRenameContainer: {
    width: '100%',
    flexDirection: 'column',
    gap: 2,
  },
  animationRenameInput: {
    flexShrink: 1,
    maxWidth: 200,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  animationListItemActive: {
    backgroundColor: '#28304b',
  },
  animationListItemText: {
    color: '#dee6ff',
    fontSize: 13,
  },
  autoPlayIndicatorButton: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  restartIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  restartIconReverse: {
    flexDirection: 'row-reverse',
  },
  restartIconBar: {
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
