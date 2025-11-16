import React from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  deleteSprite,
  listSprites,
  loadSprite,
  saveSprite,
  type SpriteEditorApi,
  type SpriteSummary,
} from 'react-native-skia-sprite-animator';
import { IconButton } from './IconButton';

interface StoragePanelProps {
  editor: SpriteEditorApi;
}

export const StoragePanel = ({ editor }: StoragePanelProps) => {
  const [sprites, setSprites] = React.useState<SpriteSummary[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');

  const refresh = React.useCallback(async () => {
    try {
      const items = await listSprites();
      setSprites(items);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!editor.state.frames.length) {
      setStatus('Add at least one frame before saving.');
      return;
    }
    const trimmedName = saveName.trim() || 'Untitled Sprite';
    setIsBusy(true);
    try {
      const payload = editor.exportJSON();
      const now = Date.now();
      await saveSprite({
        sprite: {
          ...payload,
          meta: {
            ...(payload.meta ?? {}),
            displayName: trimmedName,
            createdAt: payload.meta?.createdAt ?? now,
            updatedAt: now,
          },
        },
      });
      editor.updateMeta({ displayName: trimmedName });
      setStatus(`Saved sprite ${trimmedName}.`);
      await refresh();
      setSaveName('');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLoad = async (id: string) => {
    setIsBusy(true);
    try {
      const stored = await loadSprite(id);
      if (!stored) {
        setStatus('Sprite not found on disk.');
        return;
      }
      editor.importJSON(stored);
      setStatus(`Loaded sprite ${stored.meta.displayName}.`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleOverwrite = async (id: string, displayName: string) => {
    if (!editor.state.frames.length) {
      setStatus('Add at least one frame before saving.');
      return;
    }
    setIsBusy(true);
    try {
      const payload = editor.exportJSON();
      const stored = await loadSprite(id);
      if (!stored) {
        setStatus('Sprite not found on disk.');
        return;
      }
      const now = Date.now();
      await saveSprite({
        sprite: {
          ...payload,
          id,
          meta: {
            ...(payload.meta ?? {}),
            displayName,
            createdAt: stored.meta.createdAt ?? now,
            updatedAt: now,
          },
        },
      });
      setStatus(`Overwrote sprite ${displayName}.`);
      await refresh();
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsBusy(false);
    }
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
          setIsBusy(true);
          try {
            await deleteSprite(id);
            await refresh();
            setStatus(`Sprite ${name} removed from storage.`);
          } catch (error) {
            setStatus((error as Error).message);
          } finally {
            setIsBusy(false);
          }
        },
      },
    ]);
  };

  const handleRename = async (id: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setStatus('Name cannot be empty.');
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
    setIsBusy(true);
    try {
      const stored = await loadSprite(id);
      if (!stored) {
        setStatus('Sprite not found on disk.');
        return;
      }
      await saveSprite({
        sprite: {
          id: stored.id,
          frames: stored.frames,
          animations: stored.animations,
          animationsMeta: stored.animationsMeta,
          meta: { ...stored.meta, displayName: trimmed, updatedAt: Date.now() },
        },
      });
      setStatus(`Renamed sprite to ${trimmed}.`);
      await refresh();
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsBusy(false);
      setEditingId(null);
      setRenameDraft('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Storage</Text>
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
      <View style={styles.list}>
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
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.rowButtons}>
              {editingId === sprite.id ? null : (
                <IconButton
                  iconFamily="material"
                  name="save"
                  onPress={() => handleOverwrite(sprite.id, sprite.displayName)}
                  disabled={isBusy}
                  accessibilityLabel="Overwrite sprite with current editor state"
                />
              )}
              <IconButton
                name="file-upload"
                onPress={() => handleLoad(sprite.id)}
                disabled={isBusy}
                accessibilityLabel="Load sprite"
              />
              <IconButton
                name="delete"
                onPress={() => handleDelete(sprite.id, sprite.displayName)}
                disabled={isBusy}
                accessibilityLabel="Delete sprite"
              />
            </View>
          </View>
        ))}
        {!sprites.length && <Text style={styles.empty}>No sprites saved yet.</Text>}
      </View>
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#141925',
    borderWidth: 1,
    borderColor: '#1f2435',
  },
  heading: {
    color: '#f0f4ff',
    fontWeight: '600',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  meta: {
    marginTop: 8,
    color: '#9ea4bc',
    fontSize: 12,
  },
  list: {
    marginTop: 12,
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
  status: {
    marginTop: 8,
    color: '#7ddac9',
    fontSize: 12,
  },
});
