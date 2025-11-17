import React from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SpriteEditorApi } from '../hooks/useSpriteEditor';
import { useSpriteStorage, type SpriteStorageController } from '../hooks/useSpriteStorage';
import type { SpriteSummary } from '../../storage/spriteStorage';
import { IconButton } from './IconButton';
import { MacWindow } from './MacWindow';

interface StoragePanelProps {
  editor: SpriteEditorApi;
  visible: boolean;
  onClose: () => void;
  onSpriteSaved?: (summary: SpriteSummary) => void;
  onSpriteLoaded?: (summary: SpriteSummary) => void;
  defaultStatusMessage?: string;
  storageApi?: SpriteStorageController;
}

export const StoragePanel = ({
  editor,
  visible,
  onClose,
  onSpriteSaved,
  onSpriteLoaded,
  defaultStatusMessage,
  storageApi,
}: StoragePanelProps) => {
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
  } = useSpriteStorage({
    editor,
    controller: storageApi,
    onSpriteLoaded,
    onSpriteSaved,
  });

  React.useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [refresh, visible]);

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
    Alert.alert('Delete sprite?', `Are you sure you want to remove "${name}" from storage?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSpriteById(id, name);
        },
      },
    ]);
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
      onClose();
    }
    setEditingId(null);
    setRenameDraft('');
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <MacWindow
          title="Sprite Storage"
          onClose={onClose}
          contentStyle={styles.windowContent}
          toolbarContent={
            <View style={styles.toolbarContent}>
              <Text style={styles.toolbarStatus}>
                {status ?? defaultStatusMessage ?? 'Manage saved sprites or import past work.'}
              </Text>
            </View>
          }
          style={styles.window}
        >
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.meta}>Sprite name</Text>
              <TextInput
                style={styles.nameInput}
                value={saveName}
                onChangeText={setSaveName}
                placeholder="Untitled Sprite"
                editable={!isBusy}
              />
            </View>
            <View style={styles.formActions}>
              <IconButton
                iconFamily="material"
                name="save"
                onPress={handleSave}
                disabled={isBusy}
                accessibilityLabel="Save sprite"
              />
            </View>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sprites.map((sprite) => (
              <View key={sprite.id} style={styles.spriteRow}>
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
                        Updated {new Date(sprite.updatedAt).toLocaleString()}
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
                    accessibilityLabel="Load sprite"
                  />
                  <IconButton
                    iconFamily="material"
                    name="delete"
                    onPress={() => handleDelete(sprite.id, sprite.displayName)}
                    disabled={isBusy}
                    accessibilityLabel="Delete sprite"
                  />
                </View>
              </View>
            ))}
            {!sprites.length && (
              <Text style={styles.empty}>No sprites saved yet. Use the form above to add one.</Text>
            )}
          </ScrollView>
        </MacWindow>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  window: {
    maxWidth: 720,
  },
  windowContent: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 12,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  toolbarStatus: {
    color: '#d9def7',
    fontSize: 13,
  },
  toolbarSpacer: {
    flex: 1,
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
    maxHeight: 360,
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
});
