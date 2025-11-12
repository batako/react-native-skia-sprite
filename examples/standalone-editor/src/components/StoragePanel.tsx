import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DefaultSpriteTemplate,
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
  imageUri: string | null;
  onImageUriChange: (uri: string | null) => void;
}

export const StoragePanel = ({ editor, imageUri, onImageUriChange }: StoragePanelProps) => {
  const [sprites, setSprites] = React.useState<SpriteSummary[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

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
    if (!imageUri) {
      setStatus('Image URI is required to persist sprites.');
      return;
    }
    setIsBusy(true);
    try {
      const payload = editor.exportJSON(DefaultSpriteTemplate);
      const stored = await saveSprite({
        imageTempUri: imageUri,
        sprite: {
          ...payload,
          meta: {
            ...(payload.meta ?? {}),
            displayName: payload.meta?.displayName ?? 'Untitled Sprite',
            version: (payload.meta?.version ?? 0) + 1,
          },
        },
      });
      editor.updateMeta({
        displayName: stored.meta.displayName,
        version: stored.meta.version,
        imageUri: stored.meta.imageUri,
      });
      setStatus(`Saved sprite ${stored.meta.displayName}.`);
      await refresh();
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
      editor.importJSON(stored, DefaultSpriteTemplate);
      editor.updateMeta(stored.meta);
      onImageUriChange(stored.meta.imageUri ?? null);
      setStatus(`Loaded sprite ${stored.meta.displayName}.`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsBusy(true);
    try {
      await deleteSprite(id);
      await refresh();
      setStatus('Sprite removed from storage.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Storage</Text>
      <View style={styles.buttonRow}>
        <IconButton
          name="save"
          onPress={handleSave}
          disabled={isBusy}
          accessibilityLabel="Save sprite"
        />
        <IconButton
          name="refresh-ccw"
          onPress={refresh}
          disabled={isBusy}
          accessibilityLabel="Refresh list"
        />
      </View>
      <Text style={styles.meta}>Image URI: {imageUri ?? 'not set'}</Text>
      <View style={styles.list}>
        {sprites.map((sprite) => (
          <View key={sprite.id} style={styles.spriteRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.spriteName}>{sprite.displayName}</Text>
              <Text style={styles.spriteMeta}>{new Date(sprite.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.rowButtons}>
              <IconButton
                name="download"
                onPress={() => handleLoad(sprite.id)}
                disabled={isBusy}
                accessibilityLabel="Load sprite"
              />
              <IconButton
                name="trash"
                onPress={() => handleDelete(sprite.id)}
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
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 4,
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
