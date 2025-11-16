import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { SpriteEditorApi } from 'react-native-skia-sprite-animator';
import { IconButton } from './IconButton';

interface MetaEditorProps {
  editor: SpriteEditorApi;
}

interface MetaEntry {
  id: string;
  key: string;
  value: string;
}

export const MetaEditor = ({ editor }: MetaEditorProps) => {
  const meta = editor.state.meta;
  const [entries, setEntries] = React.useState<MetaEntry[]>([]);

  const createEntry = React.useCallback(
    (key = '', value = ''): MetaEntry => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key,
      value,
    }),
    [],
  );

  React.useEffect(() => {
    const primitiveEntries = Object.entries(meta)
      .filter(([, value]) => {
        const valueType = typeof value;
        return (
          value !== null &&
          (valueType === 'string' || valueType === 'number' || valueType === 'boolean')
        );
      })
      .map(([key, value]) => createEntry(key, String(value)));
    setEntries(primitiveEntries);
  }, [createEntry, meta]);

  const handleChange = (id: string, field: 'key' | 'value', text: string) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: text } : entry)),
    );
  };

  const handleRemove = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, createEntry()]);
  };

  const handleApply = () => {
    const payload: Record<string, unknown> = {};
    const seenKeys = new Set<string>();

    entries.forEach(({ key, value }) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return;
      }
      seenKeys.add(trimmedKey);
      payload[trimmedKey] = value;
    });

    const primitiveKeys = Object.entries(meta)
      .filter(([, value]) => {
        const type = typeof value;
        return value !== null && (type === 'string' || type === 'number' || type === 'boolean');
      })
      .map(([key]) => key);

    primitiveKeys.forEach((key) => {
      if (!seenKeys.has(key)) {
        payload[key] = undefined;
      }
    });

    editor.updateMeta(payload);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Metadata</Text>
      <View style={styles.addRow}>
        <IconButton name="add" onPress={handleAddEntry} accessibilityLabel="Add metadata entry" />
        <Text style={styles.addHint}>Add entry</Text>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Key</Text>
            <TextInput
              value={entry.key}
              onChangeText={(text) => handleChange(entry.id, 'key', text)}
              style={styles.input}
              placeholder="metadata key"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Value</Text>
            <TextInput
              value={entry.value}
              onChangeText={(text) => handleChange(entry.id, 'value', text)}
              style={styles.input}
              placeholder="value"
            />
          </View>
          <IconButton
            name="delete"
            onPress={() => handleRemove(entry.id)}
            accessibilityLabel="Remove entry"
          />
        </View>
      ))}
      <View style={styles.buttonRow}>
        <IconButton name="save" onPress={handleApply} accessibilityLabel="Apply metadata" />
      </View>
      <Text style={styles.metaSummary}>
        `editor.exportJSON()` (spriteStorage JSON) includes this metadata and persists via
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
    alignItems: 'flex-end',
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addHint: {
    color: '#9ba5c2',
    fontSize: 12,
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
