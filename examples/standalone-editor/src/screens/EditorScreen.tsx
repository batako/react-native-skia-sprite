import React from 'react';
import { Asset } from 'expo-asset';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  type SpriteEditorFrame,
  type SpriteEditorState,
  useSpriteEditor,
} from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { AnimationStudio } from '../components/AnimationStudio';
import { useEditorIntegration } from '../hooks/useEditorIntegration';

const SAMPLE_SPRITE = require('../../assets/sample-sprite.png');

const SAMPLE_FRAMES: SpriteEditorFrame[] = [
  { id: 'sample-0', x: 0, y: 0, w: 32, h: 32, duration: 80 },
  { id: 'sample-1', x: 32, y: 0, w: 32, h: 32, duration: 80 },
  { id: 'sample-2', x: 64, y: 0, w: 32, h: 32, duration: 80 },
  { id: 'sample-3', x: 96, y: 0, w: 32, h: 32, duration: 120 },
];

const SAMPLE_DEFAULT_FPS = 5;

const createDefaultMultipliers = (length: number) => new Array(length).fill(1);

const SAMPLE_INITIAL_STATE: Partial<SpriteEditorState> = {
  frames: SAMPLE_FRAMES,
  animations: {
    walk: [0, 1, 2, 3],
    blink: [1, 2, 1, 0],
  },
  animationsMeta: {
    walk: { loop: true, fps: SAMPLE_DEFAULT_FPS, multipliers: createDefaultMultipliers(4) },
    blink: { loop: false, fps: SAMPLE_DEFAULT_FPS, multipliers: createDefaultMultipliers(4) },
  },
  selected: [SAMPLE_FRAMES[0].id],
  meta: {},
};

export const EditorScreen = () => {
  const editor = useSpriteEditor({
    historyLimit: 100,
    trackSelectionInHistory: true,
    initialState: SAMPLE_INITIAL_STATE,
  });
  const integration = useEditorIntegration({ editor });

  const [imageSource, setImageSource] = React.useState<DataSourceParam>(SAMPLE_SPRITE);
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
      const nextSource = uri ?? SAMPLE_SPRITE;
      const frameImageUri = typeof uri === 'string' ? uri : undefined;
      setImageSource(nextSource);
      editorRef.current.reset({
        frames: SAMPLE_FRAMES.map((frame) => ({ ...frame, imageUri: frameImageUri })),
        animations: SAMPLE_INITIAL_STATE.animations ?? {},
        animationsMeta: SAMPLE_INITIAL_STATE.animationsMeta,
        selected: SAMPLE_INITIAL_STATE.selected ?? [],
        meta: SAMPLE_INITIAL_STATE.meta ?? {},
      });
    };
    loadSample();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sprite Editor</Text>
        </View>
        <Text style={styles.subtitle}>
          Edit frames, play animations, preview with SpriteAnimator, and persist sprites to disk
          with a single screen.
        </Text>
        <AnimationStudio editor={editor} integration={integration} image={imageSource} />
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
