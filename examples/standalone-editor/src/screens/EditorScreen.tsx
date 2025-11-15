import React from 'react';
import { Asset } from 'expo-asset';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DefaultSpriteTemplate,
  type SpriteEditorFrame,
  type SpriteEditorState,
  type SpriteTemplate,
  useSpriteEditor,
} from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { AnimationStudio } from '../components/AnimationStudio';
import { TemplatePanel } from '../components/TemplatePanel';
import { StoragePanel } from '../components/StoragePanel';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { MetaEditor } from '../components/MetaEditor';
import { useEditorIntegration } from '../hooks/useEditorIntegration';

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
  meta: {},
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
  const [isFileBrowserVisible, setFileBrowserVisible] = React.useState(false);

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

  const resetEditorState = React.useCallback(() => {
    editorRef.current.reset({
      frames: [],
      animations: {},
      animationsMeta: {},
      selected: [],
    });
  }, []);

  const handleOpenFile = React.useCallback(
    (uri: string) => {
      resetEditorState();
      handleImageUriChange(uri);
    },
    [handleImageUriChange, resetEditorState],
  );

  const handleChangeImageRequest = React.useCallback(() => {
    integration.stop();
    setFileBrowserVisible(true);
  }, [integration]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sprite Editor</Text>
        </View>
        <Text style={styles.subtitle}>
          Edit frames, play animations, switch templates, and persist sprites to disk with a single
          screen.
        </Text>
        <AnimationStudio
          editor={editor}
          integration={integration}
          image={imageSource}
          onSelectImage={handleChangeImageRequest}
        />
        <MetaEditor editor={editor} />
        <TemplatePanel editor={editor} template={template} onTemplateChange={setTemplate} />
        <StoragePanel editor={editor} imageUri={imageUri} onImageUriChange={handleImageUriChange} />
      </ScrollView>
      <FileBrowserModal
        visible={isFileBrowserVisible}
        onClose={() => setFileBrowserVisible(false)}
        onOpenFile={handleOpenFile}
        allowedMimeTypes={['image/*']}
      />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
});
