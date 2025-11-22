import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { SpriteEditorApi } from '../hooks/useSpriteEditor';
import { useSpriteStorage, type SpriteStorageController } from '../hooks/useSpriteStorage';
import type { SpriteSummary, StoredSprite } from '../../storage/spriteStorage';
import { IconButton } from './IconButton';
import { MacWindow } from './MacWindow';
import { getEditorStrings, formatEditorString } from '../localization';

const THUMB_SIZE = 56;

/**
 * Props for the {@link StoragePanel} modal.
 */
interface StoragePanelProps {
  /** Editor instance to read/write sprite data. */
  editor: SpriteEditorApi;
  /** Controls whether the modal is shown. */
  visible: boolean;
  /** Invoked when the modal should close. */
  onClose: () => void;
  /** Callback triggered after saving completes. */
  onSpriteSaved?: (summary: SpriteSummary) => void;
  /** Callback fired when a sprite is loaded. */
  onSpriteLoaded?: (summary: SpriteSummary) => void;
  /** Callback fired after deleting a sprite. */
  onSpriteDeleted?: (payload: { id: string; name: string }) => void;
  /** Callback fired when a sprite is renamed. */
  onSpriteRenamed?: (summary: SpriteSummary) => void;
  /** Custom storage API injection. */
  storageApi?: SpriteStorageController;
}

/**
 * Modal UI for working with the sprite storage controller.
 */
export const StoragePanel = ({
  editor,
  visible,
  onClose,
  onSpriteSaved,
  onSpriteLoaded,
  onSpriteDeleted,
  onSpriteRenamed,
  storageApi,
}: StoragePanelProps) => {
  const strings = React.useMemo(() => getEditorStrings(), []);
  const [saveName, setSaveName] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const {
    sprites,
    status,
    isBusy,
    refresh,
    saveSpriteAs,
    loadSpriteById,
    renameSprite,
    deleteSpriteById,
    fetchSpriteById,
  } = useSpriteStorage({
    editor,
    controller: storageApi,
    onSpriteLoaded,
    onSpriteSaved,
  });
  const [thumbnails, setThumbnails] = React.useState<Record<string, SpriteThumbnail>>({});
  const thumbnailsRef = React.useRef(thumbnails);
  React.useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);
  const [imageInfos, setImageInfos] = React.useState<Record<string, ImageInfo>>({});
  const imageInfosRef = React.useRef(imageInfos);
  React.useEffect(() => {
    imageInfosRef.current = imageInfos;
  }, [imageInfos]);

  React.useEffect(() => {
    if (visible) {
      refresh();
    } else {
      setEditingId(null);
      setRenameDraft('');
    }
  }, [refresh, visible]);

  const ensureImageInfo = React.useCallback((uri: string) => {
    if (imageInfosRef.current[uri]?.ready) {
      return;
    }
    Image.getSize(
      uri,
      (width, height) => {
        setImageInfos((prev) => ({
          ...prev,
          [uri]: { width, height, ready: true },
        }));
      },
      () => {
        setImageInfos((prev) => ({
          ...prev,
          [uri]: { width: 0, height: 0, ready: false },
        }));
      },
    );
  }, []);

  const resolvePreviewFrameIndex = React.useCallback((stored: StoredSpriteForThumb) => {
    const autoName = typeof stored.autoPlayAnimation === 'string' ? stored.autoPlayAnimation : null;
    if (autoName && stored.animations?.[autoName]?.length) {
      const candidate = stored.animations[autoName][0];
      if (typeof candidate === 'number' && stored.frames[candidate]) {
        return candidate;
      }
    }
    const firstAnimation = Object.values(stored.animations ?? {}).find(
      (sequence) => Array.isArray(sequence) && sequence.length > 0,
    );
    if (firstAnimation) {
      const candidate = firstAnimation[0];
      if (typeof candidate === 'number' && stored.frames[candidate]) {
        return candidate;
      }
    }
    return 0;
  }, []);

  const fetchThumbnail = React.useCallback(
    async (spriteId: string) => {
      const snapshot = (await fetchSpriteById(spriteId)) as StoredSpriteForThumb | null;
      if (
        !snapshot ||
        !snapshot.frames ||
        !Array.isArray(snapshot.frames) ||
        snapshot.frames.length === 0
      ) {
        return;
      }
      const frames = snapshot.frames as StoredSpriteFrame[];
      const frameIndex = resolvePreviewFrameIndex(snapshot);
      const updatedAt =
        typeof snapshot.meta?.updatedAt === 'number' ? snapshot.meta.updatedAt : Date.now();
      const frame = frames[frameIndex] ?? frames[0];
      const frameUri = frame?.imageUri;
      if (!frame || !frameUri) {
        setThumbnails((prev) => {
          if (!prev[spriteId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[spriteId];
          return next;
        });
        return;
      }
      ensureImageInfo(frameUri);
      setThumbnails((prev) => {
        const { x, y, w, h } = frame;
        if (w <= 0 || h <= 0) {
          if (!prev[spriteId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[spriteId];
          return next;
        }
        const nextThumb: SpriteThumbnail = {
          uri: frameUri,
          frame: { x, y, w, h },
          updatedAt,
        };
        const current = prev[spriteId];
        if (
          current &&
          current.updatedAt === nextThumb.updatedAt &&
          current.uri === nextThumb.uri &&
          current.frame.x === nextThumb.frame.x &&
          current.frame.y === nextThumb.frame.y &&
          current.frame.w === nextThumb.frame.w &&
          current.frame.h === nextThumb.frame.h
        ) {
          return prev;
        }
        return {
          ...prev,
          [spriteId]: nextThumb,
        };
      });
    },
    [ensureImageInfo, fetchSpriteById, resolvePreviewFrameIndex],
  );

  React.useEffect(() => {
    sprites.forEach((sprite) => {
      const existing = thumbnailsRef.current[sprite.id];
      if (!existing || existing.updatedAt !== sprite.updatedAt) {
        fetchThumbnail(sprite.id);
      }
    });
  }, [fetchThumbnail, sprites]);

  const handleSave = async () => {
    const summary = await saveSpriteAs(saveName);
    if (summary) {
      setSaveName('');
      onClose();
    }
  };

  const handleLoad = async (id: string) => {
    await loadSpriteById(id);
  };

  const handleDelete = async (id: string, name: string) => {
    if (isBusy) {
      return;
    }
    Alert.alert(
      strings.storagePanel.deleteSpriteTitle,
      formatEditorString(strings.storagePanel.deleteSpriteMessage, { name }),
      [
        { text: strings.general.cancel, style: 'cancel' },
        {
          text: strings.general.delete,
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSpriteById(id, name);
            if (success) {
              onSpriteDeleted?.({ id, name });
            }
          },
        },
      ],
    );
  };

  const handleRename = async (id: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setEditingId(null);
      setRenameDraft('');
      return;
    }
    const existing = sprites.find((sprite) => sprite.id === id);
    if (existing && existing.displayName === trimmed) {
      setEditingId(null);
      setRenameDraft('');
      return;
    }
    const result = await renameSprite(id, trimmed);
    if (result) {
      onSpriteRenamed?.(result);
      onClose();
    }
    setEditingId(null);
    setRenameDraft('');
  };

  const localizeStatus = React.useCallback(
    (message: string | null) => {
      if (!message) {
        return null;
      }
      if (message === 'Add at least one frame before saving.') {
        return strings.storagePanel.statusNeedFrames;
      }
      if (message === 'Sprite not found on disk.') {
        return strings.storagePanel.statusMissing;
      }
      if (message === 'Name cannot be empty.') {
        return strings.storagePanel.statusNameRequired;
      }
      const match = message.match(
        /^(Saved sprite|Loaded sprite|Overwrote sprite|Renamed sprite to|Deleted sprite) (.+)\.$/,
      );
      if (match) {
        const [, key, rawName] = match;
        const name = rawName.trim();
        if (key === 'Saved sprite') {
          return formatEditorString(strings.storagePanel.statusSaved, { name });
        }
        if (key === 'Loaded sprite') {
          return formatEditorString(strings.storagePanel.statusLoaded, { name });
        }
        if (key === 'Overwrote sprite') {
          return formatEditorString(strings.storagePanel.statusOverwritten, { name });
        }
        if (key === 'Renamed sprite to') {
          return formatEditorString(strings.storagePanel.statusRenamed, { name });
        }
        if (key === 'Deleted sprite') {
          return formatEditorString(strings.storagePanel.statusDeleted, { name });
        }
      }
      return message;
    },
    [
      strings.storagePanel.statusDeleted,
      strings.storagePanel.statusLoaded,
      strings.storagePanel.statusMissing,
      strings.storagePanel.statusNameRequired,
      strings.storagePanel.statusNeedFrames,
      strings.storagePanel.statusOverwritten,
      strings.storagePanel.statusRenamed,
      strings.storagePanel.statusSaved,
    ],
  );
  const translatedStatus = React.useMemo(() => localizeStatus(status), [localizeStatus, status]);

  const renderThumbnail = React.useCallback(
    (spriteId: string) => {
      const thumb = thumbnails[spriteId];
      if (!thumb) {
        return null;
      }
      const info = imageInfos[thumb.uri];
      if (!info?.ready || !info.width || !info.height) {
        return null;
      }
      const frame = thumb.frame;
      if (!frame || frame.w <= 0 || frame.h <= 0) {
        return null;
      }
      const scale = Math.min(THUMB_SIZE / frame.w, THUMB_SIZE / frame.h);
      if (!Number.isFinite(scale) || scale <= 0) {
        return null;
      }
      const boxWidth = frame.w * scale;
      const boxHeight = frame.h * scale;
      if (boxWidth <= 0 || boxHeight <= 0) {
        return null;
      }
      const imageWidth = info.width * scale;
      const imageHeight = info.height * scale;
      if (imageWidth <= 0 || imageHeight <= 0) {
        return null;
      }
      return (
        <View style={styles.thumbContainer}>
          <View style={[styles.thumbFrame, { width: boxWidth, height: boxHeight }]}>
            <Image
              source={{ uri: thumb.uri }}
              style={[
                styles.thumbFrameImage,
                {
                  width: imageWidth,
                  height: imageHeight,
                  left: -frame.x * scale,
                  top: -frame.y * scale,
                },
              ]}
              resizeMode="cover"
            />
          </View>
        </View>
      );
    },
    [imageInfos, thumbnails],
  );

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlayRoot}>
      <View style={styles.backdrop} />
      <MacWindow
        title={strings.storagePanel.title}
        onClose={onClose}
        contentStyle={styles.windowContent}
        enableCompact={false}
      >
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.meta}>{strings.storagePanel.spriteNameLabel}</Text>
            <TextInput
              style={styles.nameInput}
                value={saveName}
                onChangeText={setSaveName}
                placeholder={strings.storagePanel.spriteNamePlaceholder}
                editable={!isBusy}
              />
            </View>
            <View style={styles.formActions}>
              <IconButton
                iconFamily="material"
                name="save"
                onPress={handleSave}
                disabled={isBusy}
                accessibilityLabel={strings.storagePanel.saveSprite}
              />
            </View>
          </View>
          <View style={styles.listContainer}>
            {translatedStatus ? <Text style={styles.statusText}>{translatedStatus}</Text> : null}
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {sprites.map((sprite) => (
                <View key={sprite.id} style={styles.spriteRow}>
                  <View style={styles.thumbnailSlot}>{renderThumbnail(sprite.id)}</View>
                  <View style={{ flex: 1 }}>
                    {editingId === sprite.id ? (
                      <TextInput
                        style={styles.renameInput}
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        autoFocus
                        onSubmitEditing={() => handleRename(sprite.id, renameDraft)}
                        onBlur={() => handleRename(sprite.id, renameDraft)}
                        editable={!isBusy}
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.renameDisplay}
                        onPress={() => {
                          setEditingId(sprite.id);
                          setRenameDraft(sprite.displayName);
                        }}
                        disabled={isBusy}
                      >
                        <Text style={styles.spriteName}>{sprite.displayName}</Text>
                        <Text style={styles.spriteMeta}>
                          {strings.storagePanel.updatedPrefix}{' '}
                          {new Date(sprite.updatedAt).toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.rowButtons}>
                    <IconButton
                      iconFamily="material"
                      name="file-upload"
                      onPress={() => handleLoad(sprite.id)}
                      disabled={isBusy}
                      accessibilityLabel={strings.storagePanel.loadSprite}
                    />
                    <IconButton
                      iconFamily="material"
                      name="delete"
                      onPress={() => handleDelete(sprite.id, sprite.displayName)}
                      disabled={isBusy}
                      accessibilityLabel={strings.storagePanel.deleteSprite}
                    />
                  </View>
                </View>
              ))}
              {!sprites.length && (
                <Text style={styles.empty}>{strings.storagePanel.emptyList}</Text>
              )}
            </ScrollView>
          </View>
        </MacWindow>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 18, 0.8)',
  },
  windowContent: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 12,
  },
  listContainer: {
    flex: 1,
    width: '100%',
  },
  statusText: {
    color: '#9ea4bc',
    fontSize: 12,
    marginBottom: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 6,
  },
  nameInput: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#303852',
    backgroundColor: '#1a1f2d',
    color: '#f6f8ff',
    marginBottom: 4,
  },
  meta: {
    marginTop: 6,
    marginBottom: 6,
    color: '#9ea4bc',
    fontSize: 12,
  },
  list: {
    marginTop: 6,
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 12,
  },
  spriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#202837',
  },
  thumbnailSlot: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spriteName: {
    color: '#dfe5ff',
    fontWeight: '500',
  },
  spriteMeta: {
    color: '#929abd',
    fontSize: 12,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#39405c',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#f0f4ff',
    height: 34,
  },
  renameDisplay: {
    height: 34,
    justifyContent: 'center',
  },
  empty: {
    color: '#606984',
  },
  thumbContainer: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: '#111520',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbFrame: {
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFrameImage: {
    position: 'absolute',
  },
});

type SpriteThumbnail = {
  uri: string;
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  updatedAt?: number;
};

type StoredSpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  imageUri?: string | null;
};

type ImageInfo = {
  width: number;
  height: number;
  ready: boolean;
};

type StoredSpriteForThumb = StoredSprite & {
  animations?: Record<string, number[]>;
  frames: StoredSpriteFrame[];
  autoPlayAnimation?: string | null;
  meta?: Record<string, unknown>;
};
