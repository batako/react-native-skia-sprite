import { useCallback, useMemo, useState } from 'react';
import type { SpriteEditorApi } from 'react-native-skia-sprite-animator';

export interface MetadataEntry {
  id: string;
  key: string;
  value: string;
  readOnly?: boolean;
}

export interface UseMetadataManagerOptions {
  editor: SpriteEditorApi;
  protectedKeys?: string[];
}

export interface UseMetadataManagerResult {
  entries: MetadataEntry[];
  resetEntries: () => void;
  addEntry: () => void;
  updateEntry: (id: string, field: 'key' | 'value', text: string) => void;
  removeEntry: (id: string) => void;
  applyEntries: () => void;
}

const createEntry = (key = '', value = '', readOnly = false): MetadataEntry => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  key,
  value,
  readOnly,
});

export const useMetadataManager = ({
  editor,
  protectedKeys = [],
}: UseMetadataManagerOptions): UseMetadataManagerResult => {
  const protectedSet = useMemo(() => new Set(protectedKeys), [protectedKeys]);
  const [entries, setEntries] = useState<MetadataEntry[]>(() => {
    const meta = editor.state.meta ?? {};
    return Object.entries(meta)
      .filter(([, value]) => {
        const type = typeof value;
        return value !== null && (type === 'string' || type === 'number' || type === 'boolean');
      })
      .map(([key, value]) => createEntry(key, String(value), protectedSet.has(key)));
  });

  const resetEntries = useCallback(() => {
    const meta = editor.state.meta ?? {};
    setEntries(
      Object.entries(meta)
        .filter(([, value]) => {
          const type = typeof value;
          return value !== null && (type === 'string' || type === 'number' || type === 'boolean');
        })
        .map(([key, value]) => createEntry(key, String(value), protectedSet.has(key))),
    );
  }, [editor.state.meta, protectedSet]);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEntry()]);
  }, []);

  const updateEntry = useCallback((id: string, field: 'key' | 'value', text: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id && !entry.readOnly ? { ...entry, [field]: text } : entry,
      ),
    );
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id || entry.readOnly));
  }, []);

  const applyEntries = useCallback(() => {
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
    const primitiveKeys = Object.entries(editor.state.meta ?? {})
      .filter(([, value]) => {
        const type = typeof value;
        return value !== null && (type === 'string' || type === 'number' || type === 'boolean');
      })
      .map(([key]) => key);
    primitiveKeys.forEach((key) => {
      if (!seenKeys.has(key) && !protectedSet.has(key)) {
        payload[key] = undefined;
      }
    });
    editor.updateMeta(payload);
  }, [editor, entries, protectedSet]);

  return {
    entries,
    resetEntries,
    addEntry,
    updateEntry,
    removeEntry,
    applyEntries,
  };
};
