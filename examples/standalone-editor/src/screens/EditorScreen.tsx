import React from 'react';
import { Asset } from 'expo-asset';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  DefaultSpriteTemplate,
  type SpriteEditorFrame,
  type SpriteEditorState,
  type SpriteTemplate,
  useSpriteEditor,
} from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { SpriteCanvasView } from '../components/SpriteCanvasView';
import { FrameList } from '../components/FrameList';
import { PlaybackControls } from '../components/PlaybackControls';
import { TemplatePanel } from '../components/TemplatePanel';
import { StoragePanel } from '../components/StoragePanel';
import { MetaEditor } from '../components/MetaEditor';
import { useEditorIntegration } from '../hooks/useEditorIntegration';
import { FrameGridSelector, type FrameGridCell } from '../components/FrameGridSelector';

const SAMPLE_SPRITE = require('../../assets/sample-sprite.png');

const SAMPLE_FRAMES: SpriteEditorFrame[] = [
  { id: 'sample-0', x: 0, y: 0, w: 32, h: 32, duration: 80 },
  { id: 'sample-1', x: 32, y: 0, w: 32, h: 32, duration: 80 },
  { id: 'sample-2', x: 64, y: 0, w: 32, h: 32, duration: 80 },
  { id: 'sample-3', x: 96, y: 0, w: 32, h: 32, duration: 120 },
];

const SAMPLE_INITIAL_STATE: Partial<SpriteEditorState> = {
  frames: SAMPLE_FRAMES,
  animations: {
    walk: [0, 1, 2, 3],
    blink: [1, 2, 1, 0],
  },
  animationsMeta: {
    walk: { loop: true },
    blink: { loop: false },
  },
  selected: [SAMPLE_FRAMES[0].id],
  meta: { displayName: 'Sample Sprite', version: 1 },
};

export const EditorScreen = () => {
  const [template, setTemplate] = React.useState<SpriteTemplate<any>>(DefaultSpriteTemplate);
  const editor = useSpriteEditor({
    historyLimit: 100,
    template,
    trackSelectionInHistory: true,
    initialState: SAMPLE_INITIAL_STATE,
  });
  const integration = useEditorIntegration({ editor });

  const [imageSource, setImageSource] = React.useState<DataSourceParam>(SAMPLE_SPRITE);
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const editorRef = React.useRef(editor);

  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  React.useEffect(() => {
    let mounted = true;
    const loadSample = async () => {
      const asset = Asset.fromModule(SAMPLE_SPRITE);
      await asset.downloadAsync();
      if (!mounted) {
        return;
      }
      const uri = asset.localUri ?? asset.uri;
      setImageUri(uri);
      setImageSource(uri);
      editorRef.current.updateMeta({ imageUri: uri });
    };
    loadSample();
    return () => {
      mounted = false;
    };
  }, []);

  const handleImageUriChange = React.useCallback((uri: string | null) => {
    setImageUri(uri);
    if (uri) {
      setImageSource(uri);
      editorRef.current.updateMeta({ imageUri: uri });
    } else {
      setImageSource(SAMPLE_SPRITE);
      editorRef.current.updateMeta({ imageUri: undefined });
    }
  }, []);

  const handleGridAddFrames = React.useCallback(
    (cells: FrameGridCell[]) => {
      cells.forEach((cell) => {
        editor.addFrame({ x: cell.x, y: cell.y, w: cell.width, h: cell.height });
      });
    },
    [editor],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Sprite Editor v0.4 Preview</Text>
        <Text style={styles.subtitle}>
          Edit frames, play animations, switch templates, and persist sprites to disk with a single
          screen.
        </Text>
        <FrameGridSelector image={{ source: imageSource }} onAddFrames={handleGridAddFrames} />
        <View style={styles.canvasSection}>
          <View style={styles.canvasColumn}>
            <SpriteCanvasView editor={editor} image={imageSource} />
          </View>
          <View style={styles.canvasColumn}>
            <PlaybackControls integration={integration} image={imageSource} />
          </View>
        </View>
        <FrameList editor={editor} />
        <MetaEditor editor={editor} />
        <TemplatePanel editor={editor} template={template} onTemplateChange={setTemplate} />
        <StoragePanel editor={editor} imageUri={imageUri} onImageUriChange={handleImageUriChange} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080b12',
  },
  scroll: {
    padding: 16,
    paddingBottom: 80,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9ba5bf',
    marginTop: 4,
    marginBottom: 16,
  },
  canvasSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  canvasColumn: {
    flex: 1,
    minWidth: 320,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
});
