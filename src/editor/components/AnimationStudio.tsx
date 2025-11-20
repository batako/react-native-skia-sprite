import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType, ViewStyle } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { cleanSpriteData } from '../utils/cleanSpriteData';
import {
  saveSprite,
  listSprites,
  loadSprite,
  deleteSprite,
  type SpriteSummary,
  type StoredSprite,
} from '../../storage/spriteStorage';
import { useMetadataManager } from '../hooks/useMetadataManager';
import { useTimelineEditor } from '../hooks/useTimelineEditor';
import type { SpriteAnimationMeta, SpriteAnimationsMeta } from '../../SpriteAnimator';
import type { SpriteEditorApi } from '../hooks/useSpriteEditor';
import type { SpriteEditorFrame } from '../types';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { MaterialIcons } from '@expo/vector-icons';
import { IconButton } from './IconButton';
import { MacWindow, type MacWindowVariant } from './MacWindow';
import { AnimatedSprite2DPreview } from './AnimatedSprite2DPreview';
import {
  FrameGridSelector,
  type FrameGridCell,
  type FrameGridImageDescriptor,
} from './FrameGridSelector';
import { SelectableTextInput } from './SelectableTextInput';
import type { EditorIntegration } from '../hooks/useEditorIntegration';
import { FileBrowserModal } from './FileBrowserModal';
import { StoragePanel } from './StoragePanel';
import {
  TimelinePanel,
  type FrameImageInfo,
  type MultiplierFieldHandle,
  type TimelineSequenceCard,
} from './TimelinePanel';
import { getEditorStrings, formatEditorString } from '../localization';

/**
 * Adapter interface that lets consumers provide their own persistence layer.
 */
export interface SpriteStorageController {
  /** Persists a sprite payload. */
  saveSprite: typeof saveSprite;
  /** Loads a sprite by id; returns null when missing. */
  loadSprite: (id: string) => Promise<StoredSprite | null>;
  /** Lists available sprite saves. */
  listSprites: () => Promise<SpriteSummary[]>;
  /** Deletes a sprite by id. */
  deleteSprite: (id: string) => Promise<void>;
}

/**
 * Props for the {@link AnimationStudio} composite component.
 */
export interface AnimationStudioProps {
  /** Sprite editor instance that stores the canvas state. */
  editor: SpriteEditorApi;
  /** Integration between the editor and SpriteAnimator preview. */
  integration: EditorIntegration;
  /** Sprite sheet image source used throughout the studio. */
  image: DataSourceParam;
  /** Optional storage hooks to override persistence. */
  storageController?: SpriteStorageController;
  /** Meta keys that should be locked from editing/removal. */
  protectedMetaKeys?: string[];
}

const DEFAULT_ANIMATION_FPS = 5;
const MIN_ANIMATION_FPS = 1;
const MAX_ANIMATION_FPS = 60;
const DEFAULT_FRAME_MULTIPLIER = 1;
const MIN_FRAME_MULTIPLIER = 0.1;
const MULTIPLIER_EPSILON = 0.0001;
const DEFAULT_PROTECTED_META_KEYS = ['displayName', 'createdAt', 'updatedAt'];

const defaultStorageController: SpriteStorageController = {
  saveSprite,
  loadSprite: async (id) => {
    return loadSprite ? loadSprite(id) : null;
  },
  listSprites,
  deleteSprite,
};

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

/**
 * High-level Animation Studio that wires editor, storage, metadata, and timeline UIs together.
 */
export const AnimationStudio = ({
  editor,
  integration,
  image,
  storageController,
  protectedMetaKeys = DEFAULT_PROTECTED_META_KEYS,
}: AnimationStudioProps) => {
  const strings = useMemo(() => getEditorStrings(), []);
  const frames = editor.state.frames;
  const animations = useMemo(() => editor.state.animations ?? {}, [editor.state.animations]);
  const animationsMeta = useMemo(
    () => editor.state.animationsMeta ?? {},
    [editor.state.animationsMeta],
  );
  const legacySettingsMigratedRef = useRef(false);
  const [renamingAnimation, setRenamingAnimation] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isFramePickerVisible, setFramePickerVisible] = useState(false);
  const [framePickerVariant, setFramePickerVariant] = useState<MacWindowVariant>('default');
  const [isStorageManagerVisible, setStorageManagerVisible] = useState(false);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [lastStoredSummary, setLastStoredSummary] = useState<SpriteSummary | null>(null);
  const {
    entries: metaEntries,
    resetEntries: resetMeta,
    addEntry,
    updateEntry,
    removeEntry,
    applyEntries,
  } = useMetadataManager({ editor, protectedKeys: protectedMetaKeys });
  const [exportPreview, setExportPreview] = useState('');
  const [importText, setImportText] = useState('');
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [isMetaModalVisible, setMetaModalVisible] = useState(false);
  const [isTemplateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateModalVariant, setTemplateModalVariant] = useState<MacWindowVariant>('default');
  const storageApi = storageController ?? defaultStorageController;

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
  const [framePickerMode, setFramePickerMode] = useState<'grid' | 'single'>('grid');
  const [framePickerImage, setFramePickerImage] = useState<FrameGridImageDescriptor | null>(null);
  const [frameImageInfos, setFrameImageInfos] = useState<Record<string, FrameImageInfo>>({});
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
  const {
    clipboard: timelineClipboard,
    hasClipboard: hasTimelineClipboard,
    selectedIndex: selectedTimelineIndex,
    measuredHeight: timelineMeasuredHeight,
    filledHeight: timelineFilledHeight,
    setSelectedIndex: setTimelineSelection,
    copySelection: copyTimelineSelection,
    setMeasuredHeight: setTimelineMeasuredHeight,
    updateFilledHeight: setTimelineFilledHeight,
  } = useTimelineEditor({ onBeforeSelectionChange: commitPendingMultiplier });

  useEffect(() => {
    resetMeta();
  }, [editor.state.meta, resetMeta]);

  const buildExportPreview = useCallback(() => {
    const payload = cleanSpriteData(editor.exportJSON() as any);
    const json = JSON.stringify(payload, null, 2);
    setExportPreview(json);
    return json;
  }, [editor]);

  const handleExportTemplate = useCallback(async () => {
    try {
      const json = buildExportPreview();
      setTemplateStatus(strings.animationStudio.templateExported);
      if (Platform.OS === 'web') {
        const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
        const supported = await Linking.canOpenURL(dataUrl);
        if (supported) {
          await Linking.openURL(dataUrl);
          setTemplateStatus(strings.templateModal.downloadedMessage);
        } else {
          setTemplateStatus(strings.templateModal.downloadFailedMessage);
        }
        return;
      }
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) {
        setTemplateStatus(strings.templateModal.downloadFailedMessage);
        return;
      }
      const fileUri = `${directory}sprite-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: strings.templateModal.shareDialogTitle,
        });
      }
      setTemplateStatus(strings.templateModal.downloadedMessage);
    } catch {
      setTemplateStatus(strings.templateModal.downloadFailedMessage);
    }
  }, [
    buildExportPreview,
    strings.animationStudio.templateExported,
    strings.templateModal.downloadFailedMessage,
    strings.templateModal.downloadedMessage,
    strings.templateModal.shareDialogTitle,
  ]);

  const handleImportTemplate = useCallback(() => {
    try {
      const parsed = JSON.parse(importText);
      editor.importJSON(cleanSpriteData(parsed as any));
      setTemplateStatus(strings.animationStudio.templateImported);
      setTemplateModalVisible(false);
    } catch (error) {
      setTemplateStatus((error as Error).message);
    }
  }, [editor, importText, strings.animationStudio.templateImported]);

  const handleOpenMetaModal = useCallback(() => {
    resetMeta();
    setMetaModalVisible(true);
  }, [resetMeta]);

  const handleCloseMetaModal = useCallback(() => {
    resetMeta();
    setMetaModalVisible(false);
  }, [resetMeta]);

  const handleOpenTemplateModal = useCallback(() => {
    setTemplateStatus(null);
    setImportText('');
    buildExportPreview();
    setTemplateModalVariant('default');
    setTemplateModalVisible(true);
  }, [buildExportPreview]);

  const handleCloseTemplateModal = useCallback(() => {
    setTemplateModalVisible(false);
    setTemplateModalVariant('default');
  }, []);

  const templateModalExpanded = templateModalVariant === 'fullscreen';

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
      if (editor.state.meta?.animationSettings) {
        editor.updateMeta({ animationSettings: undefined });
      }
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
    if (editor.state.meta?.animationSettings) {
      editor.updateMeta({ animationSettings: undefined });
    }
    legacySettingsMigratedRef.current = true;
  }, [animationsMeta, editor, editor.state.meta]);

  const handleOpenStorageManager = useCallback(() => {
    setStorageManagerVisible(true);
  }, []);

  const handleCloseStorageManager = useCallback(() => {
    setStorageManagerVisible(false);
  }, []);

  const handleStorageSaved = useCallback(
    (summary: SpriteSummary) => {
      setLastStoredSummary(summary);
      setFileActionMessage(
        formatEditorString(strings.animationStudio.statusSaved, { name: summary.displayName }),
      );
    },
    [strings.animationStudio.statusSaved],
  );

  const handleStorageLoaded = useCallback(
    (summary: SpriteSummary) => {
      stop();
      setActiveAnimation(null);
      setTimelineSelection(null);
      editor.setSelection([]);
      setLastStoredSummary(summary);
      setFileActionMessage(
        formatEditorString(strings.animationStudio.statusLoaded, { name: summary.displayName }),
      );
      handleCloseStorageManager();
    },
    [
      editor,
      handleCloseStorageManager,
      setActiveAnimation,
      setTimelineSelection,
      stop,
      strings.animationStudio.statusLoaded,
    ],
  );

  const handleQuickSave = useCallback(async () => {
    if (isQuickSaving) {
      return;
    }
    if (!editor.state.frames.length) {
      setFileActionMessage(strings.animationStudio.needFramesBeforeSave);
      return;
    }
    if (!lastStoredSummary) {
      setFileActionMessage(strings.animationStudio.requireNameMessage);
      setStorageManagerVisible(true);
      return;
    }
    const resolvedDisplayName = (
      editor.state.meta?.displayName ??
      lastStoredSummary.displayName ??
      ''
    ).trim();
    if (!resolvedDisplayName.length) {
      setFileActionMessage(strings.animationStudio.requireNameMessage);
      setStorageManagerVisible(true);
      return;
    }
    setIsQuickSaving(true);
    try {
      const payload = cleanSpriteData(editor.exportJSON() as any);
      const now = Date.now();
      const stored = await storageApi.saveSprite({
        sprite: {
          ...payload,
          id: lastStoredSummary.id,
          meta: {
            ...(payload.meta ?? {}),
            displayName: resolvedDisplayName,
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
      editor.updateMeta({
        displayName: summary.displayName,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
      });
      setFileActionMessage(
        formatEditorString(strings.animationStudio.statusSaved, { name: summary.displayName }),
      );
    } catch (error) {
      setFileActionMessage((error as Error).message);
    } finally {
      setIsQuickSaving(false);
    }
  }, [
    editor,
    isQuickSaving,
    lastStoredSummary,
    storageApi,
    strings.animationStudio.needFramesBeforeSave,
    strings.animationStudio.requireNameMessage,
    strings.animationStudio.statusSaved,
  ]);

  const autoPlayAnimationName = editor.state.autoPlayAnimation ?? null;
  const animationNames = useMemo(() => Object.keys(animations), [animations]);
  const currentAnimationName = activeAnimation ?? animationNames[0];
  const hasActiveAnimation = Boolean(currentAnimationName);
  const currentSequence = useMemo(
    () => (currentAnimationName ? (animations[currentAnimationName] ?? []) : []),
    [animations, currentAnimationName],
  );
  const hasCurrentAnimationFrames = currentSequence.length > 0;
  const currentAnimationFps = currentAnimationName
    ? clampFps(animationsMeta[currentAnimationName]?.fps ?? DEFAULT_ANIMATION_FPS)
    : DEFAULT_ANIMATION_FPS;
  const currentAnimationLoop = currentAnimationName
    ? (animationsMeta[currentAnimationName]?.loop ?? true)
    : true;

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
      setRenameError(strings.animationStudio.renameMissing);
      return;
    }
    if (nextName !== renamingAnimation && animations[nextName]) {
      setRenameError(strings.animationStudio.renameDuplicate);
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
    strings.animationStudio.renameDuplicate,
    strings.animationStudio.renameMissing,
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

  const skipTimelineSelectionSeekRef = useRef(false);
  const ignoreNextTimelineCursorRef = useRef(false);

  useEffect(() => {
    if (timelineCursor === null) {
      return;
    }
    if (timelineCursor < 0 || timelineCursor >= currentSequence.length) {
      return;
    }
    if (selectedTimelineIndex === timelineCursor) {
      return;
    }
    if (ignoreNextTimelineCursorRef.current) {
      ignoreNextTimelineCursorRef.current = false;
      return;
    }
    skipTimelineSelectionSeekRef.current = true;
    setTimelineSelection(timelineCursor);
  }, [
    currentSequence.length,
    selectedTimelineIndex,
    setTimelineSelection,
    timelineCursor,
  ]);

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

  const handleRestartForward = useCallback(() => {
    if (!currentAnimationName || !currentSequence.length) {
      return;
    }
    stop();
    playForward(currentAnimationName, { fromFrame: 0 });
  }, [currentAnimationName, currentSequence.length, playForward, stop]);

  const handleRestartReverse = useCallback(() => {
    if (!currentAnimationName || !currentSequence.length) {
      return;
    }
    stop();
    playReverse(currentAnimationName, { fromFrame: currentSequence.length - 1 });
  }, [currentAnimationName, currentSequence.length, playReverse, stop]);

  const handleOpenFramePicker = useCallback(() => {
    setFramePickerMode('grid');
    setFrameSourceBrowserVisible(true);
  }, []);

  const handleOpenSingleImagePicker = useCallback(() => {
    setFramePickerMode('single');
    setFrameSourceBrowserVisible(true);
  }, []);

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

  const handleAddImageAsFullFrame = useCallback(
    (uri: string) => {
      Image.getSize(
        uri,
        (width, height) => {
          const descriptor: FrameGridImageDescriptor = {
            source: uri,
            width,
            height,
            name: uri.split('/').pop() ?? uri,
          };
          const cell: FrameGridCell = {
            id: `full-${Date.now()}`,
            row: 0,
            column: 0,
            x: 0,
            y: 0,
            width,
            height,
          };
          handleGridAddFrames([cell], descriptor);
        },
        () => {
          Alert.alert(
            strings.animationStudio.importFailedTitle,
            strings.animationStudio.importFailedDescription,
          );
        },
      );
    },
    [
      handleGridAddFrames,
      strings.animationStudio.importFailedDescription,
      strings.animationStudio.importFailedTitle,
    ],
  );

  const handleAddAnimation = () => {
    if (isPlaying) {
      stop();
    }
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
      Alert.alert(
        strings.animationStudio.deleteAnimationTitle,
        strings.animationStudio.deleteAnimationMessage,
        [
          { text: strings.general.cancel, style: 'cancel' },
          {
            text: strings.general.delete,
            style: 'destructive',
            onPress: () => handleDeleteAnimation(name),
          },
        ],
      );
    },
    [
      handleDeleteAnimation,
      strings.animationStudio.deleteAnimationMessage,
      strings.animationStudio.deleteAnimationTitle,
      strings.general.cancel,
      strings.general.delete,
    ],
  );

  const handleCopyTimelineFrame = useCallback(() => {
    copyTimelineSelection(currentSequence);
  }, [copyTimelineSelection, currentSequence]);

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
    ignoreNextTimelineCursorRef.current = true;
    selectTimelineFrame(targetIndex, next);
  };

  const sequenceCards: TimelineSequenceCard[] = currentSequence.map((frameIndex, idx) => {
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
    if (skipTimelineSelectionSeekRef.current) {
      skipTimelineSelectionSeekRef.current = false;
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
  }, [currentSequence.length, setTimelineFilledHeight, timelineMeasuredHeight]);

  const animationColumnStyle = useMemo<ViewStyle>(() => {
    const minHeight = Math.max(
      timelineFilledHeight,
      currentSequence.length > 0 ? timelineMeasuredHeight : 0,
    );
    return minHeight > 0 ? { minHeight } : {};
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
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Animation Studio</Text>
          <View style={styles.fileStatusSlot}>
            <Text
              style={[
                styles.fileStatusText,
                !(lastStoredSummary && fileActionMessage) && styles.fileStatusHidden,
              ]}
              numberOfLines={1}
            >
              {lastStoredSummary && fileActionMessage ? fileActionMessage : ' '}
            </Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <IconButton
            name="save"
            onPress={handleQuickSave}
            disabled={isQuickSaving}
            accessibilityLabel={strings.animationStudio.saveSprite}
          />
          <IconButton
            name="folder"
            onPress={handleOpenStorageManager}
            accessibilityLabel={strings.animationStudio.openStorageManager}
          />
          <IconButton
            name="edit-note"
            onPress={handleOpenMetaModal}
            accessibilityLabel={strings.animationStudio.editMetadata}
          />
          <IconButton
            name="data-object"
            onPress={handleOpenTemplateModal}
            accessibilityLabel={strings.animationStudio.openSpriteJsonTools}
          />
        </View>
      </View>
      <View style={styles.previewSection}>
        <AnimatedSprite2DPreview
          editor={editor}
          integration={integration}
          image={image}
          animationName={currentAnimationName}
          allowRendering={hasCurrentAnimationFrames}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.sequenceGroup}>
          <View
            style={[
              styles.animationListColumn,
              animationColumnStyle,
              animationColumnMaxHeight ? { maxHeight: animationColumnMaxHeight } : null,
            ]}
          >
            <Text style={styles.sectionTitle}>{strings.animationStudio.animationsTitle}</Text>
            <View style={styles.animationToolbar}>
              <IconButton
                name="add"
                onPress={handleAddAnimation}
                disabled={isPlaying}
                accessibilityLabel={strings.animationStudio.addAnimation}
              />
              <IconButton
                name="delete"
                onPress={() => currentAnimationName && confirmDeleteAnimation(currentAnimationName)}
                disabled={!currentAnimationName || isPlaying}
                accessibilityLabel={strings.animationStudio.deleteAnimation}
              />
              <View style={styles.timelineDivider} />
              <IconButton
                name="repeat"
                onPress={handleToggleAnimationLoop}
                disabled={!currentAnimationName}
                style={currentAnimationLoop ? styles.loopButtonActive : styles.loopButtonInactive}
                accessibilityLabel={
                  currentAnimationLoop
                    ? strings.animationStudio.disableLoop
                    : strings.animationStudio.enableLoop
                }
              />
            </View>
            {currentAnimationName && (
              <AnimationFpsField
                value={currentAnimationFps}
                onSubmit={handleAnimationFpsChange}
                disabled={isPlaying}
              />
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
                          ? strings.animationStudio.disableAutoplay
                          : strings.animationStudio.enableAutoplay
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
          <TimelinePanel
            isPlaying={isPlaying}
            hasActiveAnimation={hasActiveAnimation}
            currentSequenceLength={currentSequence.length}
            currentAnimationName={currentAnimationName ?? null}
            sequenceCards={sequenceCards}
            selectedTimelineIndex={selectedTimelineIndex}
            selectedMultiplier={selectedMultiplier}
            selectedFrame={selectedFrame}
            hasClipboard={hasTimelineClipboard}
            defaultFrameMultiplier={DEFAULT_FRAME_MULTIPLIER}
            timelineMeasuredHeight={timelineMeasuredHeight}
            onTimelineMeasured={setTimelineMeasuredHeight}
            onPlayFromSelection={handlePlayFromSelection}
            onReverseFromSelection={handleReverseFromSelection}
            onRestartForward={handleRestartForward}
            onRestartReverse={handleRestartReverse}
            onPause={pause}
            onStop={stop}
            onOpenFramePicker={handleOpenFramePicker}
            onOpenImagePicker={handleOpenSingleImagePicker}
            onCopy={handleCopyTimelineFrame}
            onPaste={handlePasteTimelineFrame}
            onMoveLeft={() => handleMoveTimelineFrame(-1)}
            onMoveRight={() => handleMoveTimelineFrame(1)}
            onRemove={handleRemoveTimelineFrame}
            onSelectFrame={selectTimelineFrame}
            multiplierRef={multiplierFieldRef}
            onSubmitMultiplier={handleMultiplierSubmit}
            timelineImageSource={timelineImageSource ?? undefined}
            frameImageInfos={frameImageInfos}
            fallbackImageInfo={imageInfo}
            animationsMeta={animationsMeta}
          />
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
            title={strings.framePicker.title}
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
              emptyMessage={strings.framePicker.emptyMessage}
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
          if (framePickerMode === 'single') {
            handleAddImageAsFullFrame(uri);
            return;
          }
          setFramePickerVariant('default');
          setFramePickerImage({
            source: uri,
            name: uri.split('/').pop() ?? uri,
          });
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
        storageApi={{
          listSprites: storageApi.listSprites,
          loadSprite: storageApi.loadSprite,
          deleteSprite: storageApi.deleteSprite,
          saveSprite: storageApi.saveSprite,
        }}
      />
      <Modal
        visible={isMetaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMetaModal}
      >
        <View style={styles.modalOverlay}>
          <MacWindow
            title={strings.metadataModal.title}
            onClose={handleCloseMetaModal}
            contentStyle={styles.metaModalContent}
            enableCompact={false}
            style={styles.metaModalWindow}
          >
            <View style={styles.metaHeaderRow}>
              <Text style={styles.metaHeading}>{strings.metadataModal.heading}</Text>
              <IconButton
                name="add"
                onPress={addEntry}
                accessibilityLabel={strings.metadataModal.addEntry}
              />
            </View>
            <ScrollView style={styles.metaRowsStack} contentContainerStyle={styles.metaRowsContent}>
              {metaEntries.map((entry) => (
                <View key={entry.id} style={styles.metaRow}>
                  <View style={styles.metaField}>
                    <Text style={styles.metaLabel}>{strings.metadataModal.keyLabel}</Text>
                    <TextInput
                      value={entry.key}
                      onChangeText={(text) => updateEntry(entry.id, 'key', text)}
                      style={styles.metaInput}
                      editable={!entry.readOnly}
                      placeholder={strings.metadataModal.keyPlaceholder}
                    />
                  </View>
                  <View style={styles.metaField}>
                    <Text style={styles.metaLabel}>{strings.metadataModal.valueLabel}</Text>
                    <TextInput
                      value={entry.value}
                      onChangeText={(text) => updateEntry(entry.id, 'value', text)}
                      style={styles.metaInput}
                      editable={!entry.readOnly}
                      placeholder={strings.metadataModal.valuePlaceholder}
                    />
                  </View>
                  {entry.readOnly ? (
                    <View style={styles.metaDeleteSpacer} />
                  ) : (
                    <IconButton
                      name="delete"
                      onPress={() => removeEntry(entry.id)}
                      accessibilityLabel={strings.metadataModal.removeEntry}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.metaButtonRow}>
              <IconButton
                name="save"
                onPress={applyEntries}
                accessibilityLabel={strings.metadataModal.apply}
              />
            </View>
            <Text style={styles.metaHelpText}>{strings.metadataModal.helpText}</Text>
          </MacWindow>
        </View>
      </Modal>
      <Modal
        visible={isTemplateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseTemplateModal}
      >
        <View style={styles.modalOverlay}>
          <MacWindow
            title={strings.templateModal.title}
            onClose={handleCloseTemplateModal}
            contentStyle={styles.templateModalContent}
            enableCompact={false}
            onVariantChange={setTemplateModalVariant}
            style={styles.templateModalWindow}
          >
            <View style={styles.templateContent}>
              <Text style={styles.templateDescription}>{strings.templateModal.description}</Text>
              <View
                style={[
                  styles.templateSection,
                  templateModalExpanded && styles.templateSectionExpanded,
                ]}
              >
                <View style={styles.templateFieldHeader}>
                  <TouchableOpacity
                    style={[styles.templateFieldButton, styles.templateFieldButtonLight]}
                    onPress={handleExportTemplate}
                    accessibilityRole="button"
                    accessibilityLabel={strings.templateModal.exportButton}
                  >
                    <MaterialIcons name="file-download" size={18} color="#0f172a" />
                    <Text style={[styles.templateFieldButtonLabel, styles.templateFieldButtonLabelDark]}>
                      {strings.templateModal.exportButton}
                    </Text>
                  </TouchableOpacity>
                </View>
                <SelectableTextInput
                  style={[
                    styles.templateTextArea,
                    templateModalExpanded && styles.templateTextAreaExpanded,
                    styles.templateTextAreaFixed,
                  ]}
                  multiline
                  value={exportPreview}
                  onChangeText={() => {}}
                  placeholder={strings.templateModal.exportPlaceholder}
                />
              </View>
              <View
                style={[
                  styles.templateSection,
                  templateModalExpanded && styles.templateSectionExpanded,
                ]}
              >
                <View style={styles.templateFieldHeader}>
                  <TouchableOpacity
                    style={[
                      styles.templateFieldButton,
                      styles.templateFieldButtonLight,
                      !importText.trim() && styles.templateFieldButtonDisabled,
                    ]}
                    onPress={handleImportTemplate}
                    disabled={!importText.trim()}
                    accessibilityRole="button"
                    accessibilityLabel={strings.templateModal.importButton}
                  >
                    <MaterialIcons name="file-upload" size={18} color="#0f172a" />
                    <Text
                      style={[
                        styles.templateFieldButtonLabel,
                        styles.templateFieldButtonLabelDark,
                        !importText.trim() && styles.templateFieldButtonLabelDisabled,
                      ]}
                    >
                      {strings.templateModal.importButton}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.templateTextArea,
                    templateModalExpanded && styles.templateTextAreaExpanded,
                    styles.templateTextAreaFixed,
                  ]}
                  multiline
                  value={importText}
                  onChangeText={setImportText}
                  placeholder={strings.templateModal.importPlaceholder}
                />
              </View>
              {templateStatus ? <Text style={styles.templateStatus}>{templateStatus}</Text> : null}
            </View>
          </MacWindow>
        </View>
      </Modal>
    </View>
  );
};

interface AnimationFpsFieldProps {
  value: number;
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

const AnimationFpsField = ({ value, onSubmit, disabled = false }: AnimationFpsFieldProps) => {
  const strings = useMemo(() => getEditorStrings(), []);
  const [text, setText] = useState(String(value));
  const [isFocused, setFocused] = useState(false);
  const baseValue = String(value);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isFocused) {
      setText(baseValue);
    }
  }, [baseValue, isFocused]);

  const commit = () => {
    const parsed = Number(text);
    if (!Number.isNaN(parsed)) {
      onSubmit(parsed);
    } else {
      setText(baseValue);
    }
  };

  return (
    <View style={styles.animationFpsRow}>
      <Text style={styles.animationFpsLabel}>FPS</Text>
      <SelectableTextInput
        ref={inputRef}
        style={[styles.animationFpsInput, disabled && styles.animationFpsInputDisabled]}
        value={text}
        editable={!disabled}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onSubmitEditing={commit}
        returnKeyType="done"
      />
    </View>
  );
};

const useImageDimensions = (source: DataSourceParam): FrameImageInfo | null => {
  const [state, setState] = useState<FrameImageInfo | null>(null);

  useEffect(() => {
    if (typeof source === 'number') {
      const resolved = Image.resolveAssetSource(source);
      if (resolved?.width && resolved?.height) {
        setState({ width: resolved.width, height: resolved.height, ready: true });
      } else {
        setState({ width: 0, height: 0, ready: false });
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
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#10141d',
    borderWidth: 1,
    borderColor: '#1f2430',
  },
  headerRow: {
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    color: '#f1f5ff',
    fontSize: 18,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileStatusSlot: {
    minWidth: 140,
    flexShrink: 1,
    alignItems: 'flex-start',
    marginTop: -2,
  },
  fileStatusText: {
    color: '#7f8aac',
    fontSize: 11,
    lineHeight: 13,
    marginBottom: 0,
  },
  fileStatusHidden: {
    opacity: 0,
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
    marginTop: 8,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2436',
    backgroundColor: '#151b2a',
    padding: 12,
    alignItems: 'center',
  },
  body: {
    marginTop: 12,
    width: '100%',
  },
  metaModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  metaModalWindow: {
    minHeight: 520,
    maxHeight: '90%',
  },
  metaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaHeading: {
    color: '#e2e7ff',
    fontWeight: '600',
  },
  metaRowsStack: {
    flex: 1,
    marginBottom: 8,
  },
  metaRowsContent: {
    paddingBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  metaField: {
    flex: 1,
  },
  metaLabel: {
    color: '#9ba5c2',
    fontSize: 12,
    marginBottom: 4,
  },
  metaInput: {
    backgroundColor: '#111520',
    color: '#f6f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#232a3c',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaDeleteSpacer: {
    width: 32,
  },
  metaButtonRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metaHelpText: {
    color: '#8f97b0',
    fontSize: 12,
  },
  templateModalContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  templateModalWindow: {
    minHeight: 520,
    maxHeight: '90%',
  },
  templateContent: {
    flex: 1,
    marginTop: 8,
  },
  templateDescription: {
    color: '#9aa4bd',
    fontSize: 12,
  },
  templateFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  templateFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2e3545',
    backgroundColor: '#13192b',
  },
  templateFieldButtonLight: {
    borderColor: '#c4cad9',
    backgroundColor: '#fff',
  },
  templateFieldButtonDisabled: {
    opacity: 0.4,
  },
  templateFieldButtonLabel: {
    color: '#f1f5ff',
    fontWeight: '600',
    fontSize: 12,
  },
  templateFieldButtonLabelDark: {
    color: '#0f172a',
  },
  templateFieldButtonLabelDisabled: {
    color: '#6c7283',
  },
  templateSection: {
    marginTop: 12,
  },
  templateSectionExpanded: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  templateTextArea: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e3545',
    padding: 8,
    color: '#f6f7ff',
    fontFamily: 'Courier',
    width: '100%',
    height: 150,
  },
  templateTextAreaFixed: {
    textAlignVertical: 'top',
  },
  templateTextAreaExpanded: {
    height: undefined,
    minHeight: 150,
    flex: 1,
  },
  templateStatus: {
    marginTop: 4,
    color: '#7ddac9',
    fontSize: 12,
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
  timelineDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 0,
    marginRight: 8,
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
    position: 'relative',
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
  animationFpsInputDisabled: {
    opacity: 0.5,
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
  sectionTitle: {
    color: '#dfe7ff',
    fontWeight: '600',
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
    minHeight: 0,
  },
});
