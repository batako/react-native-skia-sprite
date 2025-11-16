import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type {
  SpriteAnimationsMeta,
  SpriteEditorApi,
  SpriteTemplate,
} from 'react-native-skia-sprite-animator';
import { DefaultSpriteTemplate, cleanSpriteData } from 'react-native-skia-sprite-animator';
import { IconButton } from './IconButton';

interface TemplatePanelProps {
  editor: SpriteEditorApi;
  template: SpriteTemplate<any>;
  onTemplateChange: (template: SpriteTemplate<any>) => void;
}

interface CompactTemplatePayload {
  name: string;
  frames: [number, number, number, number][];
  animations?: Record<string, number[]>;
  animationsMeta?: SpriteAnimationsMeta;
}

const createFrameId = () => `frame_${Math.random().toString(36).slice(2, 10)}`;

const CompactSpriteTemplate: SpriteTemplate<CompactTemplatePayload> = {
  name: 'compact-json',
  version: 1,
  toJSON: (state) => ({
    name: state.meta.displayName ?? 'Untitled Sprite',
    frames: state.frames.map((frame) => [frame.x, frame.y, frame.w, frame.h]),
    animations: state.animations,
    animationsMeta: state.animationsMeta,
  }),
  fromJSON: (payload) => {
    if (!payload?.frames) {
      return null;
    }
    return {
      frames: payload.frames.map(([x, y, w, h]) => ({
        id: createFrameId(),
        x,
        y,
        w,
        h,
      })),
      animations: payload.animations ?? {},
      animationsMeta: payload.animationsMeta,
      selected: [],
      meta: { displayName: payload.name },
    };
  },
};

const templates = [
  {
    template: DefaultSpriteTemplate,
    label: 'Sprite Storage (Default)',
    description: 'Compatible with spriteStorage save/load helpers and SpriteAnimator.',
  },
  {
    template: CompactSpriteTemplate,
    label: 'Compact JSON',
    description: 'Demonstrates how to shape editor state into a flat array payload.',
  },
];

export const TemplatePanel = ({ editor, template, onTemplateChange }: TemplatePanelProps) => {
  const [exportPreview, setExportPreview] = React.useState('');
  const [importText, setImportText] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);

  const handleExport = () => {
    const payload = cleanSpriteData(editor.exportJSON(template));
    setExportPreview(JSON.stringify(payload, null, 2));
    setStatus(`Exported using template "${template.name}".`);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      editor.importJSON(cleanSpriteData(parsed), template);
      setStatus('Import succeeded and editor history was reset.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Templates</Text>
      <View style={styles.templateList}>
        {templates.map((entry) => {
          const isActive = entry.template === template;
          return (
            <Pressable
              key={entry.template.name}
              onPress={() => onTemplateChange(entry.template)}
              style={[styles.templateCard, isActive && styles.templateCardActive]}
            >
              <Text style={styles.templateName}>{entry.label}</Text>
              <Text style={styles.templateMeta}>
                name={entry.template.name} v{entry.template.version}
              </Text>
              <Text style={styles.templateDescription}>{entry.description}</Text>
            </Pressable>
          );
        })}
      </View>
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
    marginBottom: 8,
  },
  templateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  templateCard: {
    flexBasis: '48%',
    marginRight: '2%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#111622',
    borderWidth: 1,
    borderColor: '#2b3244',
  },
  templateCardActive: {
    borderColor: '#4f8dff',
  },
  templateName: {
    color: '#dfe4f7',
    fontWeight: '600',
  },
  templateMeta: {
    color: '#8e96ac',
    fontSize: 12,
    marginBottom: 4,
  },
  templateDescription: {
    color: '#9aa4bd',
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
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
