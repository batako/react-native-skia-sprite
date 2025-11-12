import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { SpriteEditorApi } from 'react-native-skia-sprite-animator';
import { IconButton } from './IconButton';

interface MetaEditorProps {
  editor: SpriteEditorApi;
}

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const MetaEditor = ({ editor }: MetaEditorProps) => {
  const meta = editor.state.meta;
  const origin = (meta.origin as { x?: number; y?: number } | undefined) ?? { x: 0, y: 0 };
  const [displayName, setDisplayName] = React.useState(meta.displayName ?? '');
  const [version, setVersion] = React.useState(String(meta.version ?? 1));
  const [originX, setOriginX] = React.useState(String(origin.x ?? 0));
  const [originY, setOriginY] = React.useState(String(origin.y ?? 0));

  React.useEffect(() => {
    setDisplayName(meta.displayName ?? '');
    setVersion(String(meta.version ?? 1));
    const latestOrigin = (meta.origin as { x?: number; y?: number } | undefined) ?? { x: 0, y: 0 };
    setOriginX(String(latestOrigin.x ?? 0));
    setOriginY(String(latestOrigin.y ?? 0));
  }, [meta]);

  const handleApply = () => {
    editor.updateMeta({
      displayName: displayName || undefined,
      version: toNumber(version, 1),
      origin: {
        x: toNumber(originX, 0),
        y: toNumber(originY, 0),
      },
    });
  };

  const incrementVersion = () => {
    const next = (meta.version ?? 0) + 1;
    editor.updateMeta({ version: next });
    setVersion(String(next));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Metadata</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
            placeholder="Sprite name"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Version</Text>
          <TextInput
            value={version}
            onChangeText={setVersion}
            style={styles.input}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Origin X</Text>
          <TextInput
            value={originX}
            onChangeText={setOriginX}
            style={styles.input}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Origin Y</Text>
          <TextInput
            value={originY}
            onChangeText={setOriginY}
            style={styles.input}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.buttonRow}>
        <IconButton name="check" onPress={handleApply} accessibilityLabel="Apply metadata" />
        <IconButton
          name="plus-circle"
          onPress={incrementVersion}
          accessibilityLabel="Increment version"
        />
      </View>
      <Text style={styles.metaSummary}>
        Active template exports this metadata via `editor.exportJSON` and persists through
        spriteStorage.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#181e2b',
    borderWidth: 1,
    borderColor: '#21293a',
  },
  heading: {
    color: '#e2e7ff',
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  field: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    color: '#9ba5c2',
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#111520',
    color: 'white',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#232a3c',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  metaSummary: {
    marginTop: 10,
    color: '#848da9',
    fontSize: 12,
  },
});
