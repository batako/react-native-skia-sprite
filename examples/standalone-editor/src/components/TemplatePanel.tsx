import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { SpriteEditorApi } from 'react-native-skia-sprite-animator';
import { cleanSpriteData } from 'react-native-skia-sprite-animator';
import { IconButton } from './IconButton';

interface TemplatePanelProps {
  editor: SpriteEditorApi;
}

export const TemplatePanel = ({ editor }: TemplatePanelProps) => {
  const [exportPreview, setExportPreview] = React.useState('');
  const [importText, setImportText] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);

  const handleExport = () => {
    const payload = cleanSpriteData(editor.exportJSON());
    setExportPreview(JSON.stringify(payload, null, 2));
    setStatus('Exported spriteStorage-compatible JSON.');
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      editor.importJSON(cleanSpriteData(parsed));
      setStatus('Import succeeded and editor history was reset.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sprite JSON</Text>
      <Text style={styles.description}>
        Uses the same format consumed by SpriteAnimator previews and spriteStorage save/load
        helpers.
      </Text>
      <View style={styles.buttonRow}>
        <IconButton
          name="file-download"
          onPress={handleExport}
          accessibilityLabel="Export template"
        />
        <IconButton
          name="file-upload"
          onPress={handleImport}
          disabled={!importText.trim()}
          accessibilityLabel="Import template"
        />
      </View>
      <Text style={styles.subheading}>Export Preview</Text>
      <TextInput
        style={styles.textArea}
        multiline
        editable={false}
        value={exportPreview}
        placeholder="Press Export to view the current payload"
      />
      <Text style={styles.subheading}>Import JSON</Text>
      <TextInput
        style={styles.textArea}
        multiline
        value={importText}
        onChangeText={setImportText}
        placeholder="Paste template payload here and press Import"
      />
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1f2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#20283c',
  },
  heading: {
    color: '#e7ecff',
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#9aa4bd',
    fontSize: 12,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  subheading: {
    marginTop: 12,
    color: '#9ea8c0',
    fontWeight: '500',
    fontSize: 12,
  },
  textArea: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e3545',
    padding: 8,
    minHeight: 90,
    color: '#f6f7ff',
    fontFamily: 'Courier',
  },
  status: {
    marginTop: 8,
    color: '#7ddac9',
    fontSize: 12,
  },
});
