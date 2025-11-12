import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SpriteEditorApi } from 'react-native-skia-sprite-animator';
import { IconButton } from './IconButton';

export interface FrameListProps {
  editor: SpriteEditorApi;
}

const DEFAULT_FRAME = { x: 0, y: 0, w: 32, h: 32, duration: 80 };

export const FrameList = ({ editor }: FrameListProps) => {
  const frames = editor.state.frames;
  const selected = editor.state.selected;

  const handleAddFrame = useCallback(() => {
    const last = frames[frames.length - 1];
    const base = last
      ? { x: last.x + last.w, y: last.y, w: last.w, h: last.h, duration: last.duration }
      : DEFAULT_FRAME;
    editor.addFrame(base);
  }, [editor, frames]);

  const handleDeleteSelected = useCallback(() => {
    if (!selected.length) {
      return;
    }
    editor.removeFrames(selected);
  }, [editor, selected]);

  const handleDuplicate = useCallback(() => {
    if (!selected.length) {
      return;
    }
    editor.copySelected();
    editor.pasteClipboard({ index: frames.length });
  }, [editor, frames, selected]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Frames ({frames.length})</Text>
      <View style={styles.toolbar}>
        <IconButton name="plus-square" onPress={handleAddFrame} accessibilityLabel="Add frame" />
        <IconButton
          name="copy"
          onPress={handleDuplicate}
          disabled={!selected.length}
          accessibilityLabel="Duplicate selected frames"
        />
        <IconButton
          name="trash-2"
          onPress={handleDeleteSelected}
          disabled={!selected.length}
          accessibilityLabel="Delete selected frames"
        />
        <IconButton
          name="clipboard"
          onPress={editor.copySelected}
          disabled={!selected.length}
          accessibilityLabel="Copy selected frames"
        />
        <IconButton
          name="scissors"
          onPress={editor.cutSelected}
          disabled={!selected.length}
          accessibilityLabel="Cut selected frames"
        />
        <IconButton
          name="clipboard"
          onPress={() => editor.pasteClipboard()}
          accessibilityLabel="Paste frames"
        />
        <IconButton
          name="rotate-ccw"
          onPress={editor.undo}
          disabled={!editor.canUndo}
          accessibilityLabel="Undo"
        />
        <IconButton
          name="rotate-cw"
          onPress={editor.redo}
          disabled={!editor.canRedo}
          accessibilityLabel="Redo"
        />
        <IconButton
          name="check-square"
          onPress={editor.selectAll}
          accessibilityLabel="Select all"
        />
        <IconButton
          name="x-square"
          onPress={editor.clearSelection}
          accessibilityLabel="Clear selection"
        />
      </View>
      <ScrollView style={styles.list}>
        {frames.map((frame, index) => (
          <View
            key={frame.id}
            style={[styles.frameRow, selected.includes(frame.id) && styles.frameRowSelected]}
          >
            <View style={styles.frameHeader}>
              <Text style={styles.frameTitle}>Frame #{index + 1}</Text>
              <View style={styles.frameActions}>
                <IconButton
                  name="mouse-pointer"
                  onPress={() => editor.selectFrame(frame.id, { toggle: true })}
                  accessibilityLabel="Toggle frame selection"
                />
                <IconButton
                  name="arrow-up"
                  onPress={() => editor.reorderFrames(index, Math.max(0, index - 1))}
                  disabled={index === 0}
                  accessibilityLabel="Move frame up"
                />
                <IconButton
                  name="arrow-down"
                  onPress={() =>
                    editor.reorderFrames(index, Math.min(frames.length - 1, index + 1))
                  }
                  disabled={index === frames.length - 1}
                  accessibilityLabel="Move frame down"
                />
              </View>
            </View>
            <View style={styles.inputsRow}>
              <FrameField
                label="X"
                value={frame.x}
                onSubmit={(value) => editor.updateFrame(frame.id, { x: value })}
              />
              <FrameField
                label="Y"
                value={frame.y}
                onSubmit={(value) => editor.updateFrame(frame.id, { y: value })}
              />
              <FrameField
                label="W"
                value={frame.w}
                onSubmit={(value) => editor.updateFrame(frame.id, { w: value })}
              />
              <FrameField
                label="H"
                value={frame.h}
                onSubmit={(value) => editor.updateFrame(frame.id, { h: value })}
              />
              <FrameField
                label="ms"
                value={frame.duration ?? DEFAULT_FRAME.duration}
                onSubmit={(value) => editor.updateFrame(frame.id, { duration: value })}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

interface FrameFieldProps {
  label: string;
  value: number;
  onSubmit: (value: number) => void;
}

const FrameField = ({ label, value, onSubmit }: FrameFieldProps) => {
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(String(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = Number(text);
    if (!Number.isNaN(parsed)) {
      onSubmit(parsed);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={handleBlur}
        style={styles.fieldInput}
        keyboardType="numeric"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#1f2430',
  },
  heading: {
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  list: {
    marginTop: 12,
    maxHeight: 320,
  },
  frameRow: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#11141b',
    marginBottom: 10,
  },
  frameRowSelected: {
    borderWidth: 1,
    borderColor: '#4f8dff',
  },
  frameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  frameTitle: {
    color: '#dfe7ff',
    fontWeight: '500',
  },
  frameActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  field: {
    width: 64,
    marginRight: 10,
    marginBottom: 8,
  },
  fieldLabel: {
    color: '#9da7be',
    fontSize: 12,
  },
  fieldInput: {
    backgroundColor: '#1f2532',
    color: 'white',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
