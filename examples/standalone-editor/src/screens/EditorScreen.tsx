import React from 'react';
import { Asset } from 'expo-asset';
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  type SpriteEditorFrame,
  type SpriteEditorState,
  useSpriteEditor,
  getEditorStrings,
  SPRITE_ANIMATOR_VERSION,
} from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import { AnimationStudio } from '../components/AnimationStudio';
import { useEditorIntegration } from '../hooks/useEditorIntegration';
import { LegalModal } from '../components/LegalModal';
import { IconButton } from '../components/IconButton';

const SAMPLE_SPRITE = require('../../assets/sample-sprite.png');
type LicenseEntry = {
  name: string;
  version: string;
  licenses: string;
  repository?: string;
  publisher?: string;
};
const licenseEntries = require('../licenses/licenses.json') as LicenseEntry[];
type ExpoManifest = {
  expo?: {
    version?: string;
    ios?: {
      buildNumber?: string;
    };
    android?: {
      versionCode?: number;
    };
  };
};
const expoManifest = require('../../app.json') as ExpoManifest;
const HELP_FORM_URL = 'https://forms.gle/qYn7Dza4rXuSa1498';
const GITHUB_URL = 'https://github.com/batako/react-native-skia-sprite-animator';
const VERSION_SUMMARY = (() => {
  const appVersion = expoManifest?.expo?.version ?? '0.0.0';
  const iosBuildNumber = expoManifest?.expo?.ios?.buildNumber ?? '1';
  const androidCode =
    expoManifest?.expo?.android?.versionCode !== undefined
      ? String(expoManifest.expo?.android?.versionCode)
      : '1';
  const builds = Array.from(new Set([iosBuildNumber, androidCode].filter(Boolean)));
  const buildLabel = builds.join(' / ');
  return `v${appVersion} (${buildLabel})`;
})();

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

/**
 * The standalone editor demo screen that wires up AnimationStudio.
 */
export const EditorScreen = () => {
  const editor = useSpriteEditor({
    historyLimit: 100,
    trackSelectionInHistory: true,
    initialState: SAMPLE_INITIAL_STATE,
  });
  const integration = useEditorIntegration({ editor });
  const strings = React.useMemo(() => getEditorStrings(), []);
  const legalStrings = strings.editorScreen;

  const [imageSource, setImageSource] = React.useState<DataSourceParam>(SAMPLE_SPRITE);
  const editorRef = React.useRef(editor);
  const [legalModal, setLegalModal] = React.useState<
    'overview' | 'terms' | 'privacy' | 'licenses' | null
  >(null);

  const handleOpenLink = React.useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      // ignore
    });
  }, []);

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
          <View style={styles.titleRow}>
            <Text style={styles.title}>React Native Skia Sprite Animator</Text>
            <Text style={styles.versionLabel}>{`v${SPRITE_ANIMATOR_VERSION}`}</Text>
          </View>
          <IconButton
            iconFamily="material"
            name="info-outline"
            onPress={() => setLegalModal('overview')}
            accessibilityLabel={legalStrings.infoCenterTitle}
          />
        </View>
        <Text style={styles.subtitle}>{strings.editorScreen.subtitle}</Text>
        <AnimationStudio editor={editor} integration={integration} image={imageSource} />
      </ScrollView>
      <LegalModal
        title={legalStrings.infoCenterTitle}
        visible={legalModal === 'overview'}
        onClose={() => setLegalModal(null)}
      >
        <Text style={styles.modalSectionHeading}>{legalStrings.legalHeading}</Text>
        <Text style={styles.legalParagraph}>{legalStrings.legalOverviewIntro}</Text>
        <View style={styles.inlineLinks}>
          <Pressable
            style={styles.inlineLink}
            onPress={() => setLegalModal('terms')}
            accessibilityRole="button"
          >
            <Text style={styles.inlineLinkLabel}>{legalStrings.termsTitle}</Text>
            <Text style={styles.inlineLinkArrow}>›</Text>
          </Pressable>
          <Pressable
            style={styles.inlineLink}
            onPress={() => setLegalModal('privacy')}
            accessibilityRole="button"
          >
            <Text style={styles.inlineLinkLabel}>{legalStrings.privacyTitle}</Text>
            <Text style={styles.inlineLinkArrow}>›</Text>
          </Pressable>
          <Pressable
            style={styles.inlineLink}
            onPress={() => setLegalModal('licenses')}
            accessibilityRole="button"
          >
            <Text style={styles.inlineLinkLabel}>{legalStrings.licensesTitle}</Text>
            <Text style={styles.inlineLinkArrow}>›</Text>
          </Pressable>
        </View>
        <Text style={[styles.modalSectionHeading, styles.helpSectionHeading]}>
          {legalStrings.helpHeading}
        </Text>
        <Text style={styles.legalParagraph}>{legalStrings.helpOverviewIntro}</Text>
        <View style={styles.inlineLinks}>
          <Pressable
            style={styles.inlineLink}
            onPress={() => handleOpenLink(HELP_FORM_URL)}
            accessibilityRole="link"
          >
            <Text style={styles.inlineLinkLabel}>{legalStrings.contactLinkLabel}</Text>
            <Text style={styles.inlineLinkArrow}>↗</Text>
          </Pressable>
          <Pressable
            style={styles.inlineLink}
            onPress={() => handleOpenLink(GITHUB_URL)}
            accessibilityRole="link"
          >
            <Text style={styles.inlineLinkLabel}>{legalStrings.githubLinkLabel}</Text>
            <Text style={styles.inlineLinkArrow}>↗</Text>
          </Pressable>
        </View>
        <View style={styles.versionMetaWrapper}>
          <Text style={styles.versionMetaLabel}>{legalStrings.appVersionLabel}</Text>
          <Text style={styles.versionMetaValue}>{VERSION_SUMMARY}</Text>
        </View>
      </LegalModal>
      <LegalModal
        title={legalStrings.termsTitle}
        visible={legalModal === 'terms'}
        onClose={() => setLegalModal('overview')}
      >
        <Text style={styles.legalParagraph}>{legalStrings.termsBodyIntro}</Text>
        <Text style={styles.legalParagraph}>{legalStrings.termsBodyUse}</Text>
        <Text style={styles.legalParagraph}>{legalStrings.termsBodyContact}</Text>
      </LegalModal>
      <LegalModal
        title={legalStrings.privacyTitle}
        visible={legalModal === 'privacy'}
        onClose={() => setLegalModal('overview')}
      >
        <Text style={styles.legalParagraph}>{legalStrings.privacyBodyIntro}</Text>
        <Text style={styles.legalParagraph}>{legalStrings.privacyBodyContact}</Text>
      </LegalModal>
      <LegalModal
        title={legalStrings.licensesTitle}
        visible={legalModal === 'licenses'}
        onClose={() => setLegalModal('overview')}
      >
        <Text style={styles.legalParagraph}>{legalStrings.licensesIntro}</Text>
        {licenseEntries.map((entry) => (
          <View key={`${entry.name}@${entry.version}`} style={styles.licenseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.licenseName}>{`${entry.name}@${entry.version}`}</Text>
              {!!entry.repository && <Text style={styles.licenseMeta}>{entry.repository}</Text>}
              {!!entry.licenses && <Text style={styles.licenseMeta}>{entry.licenses}</Text>}
            </View>
            {!!entry.publisher && <Text style={styles.licenseVersion}>{entry.publisher}</Text>}
          </View>
        ))}
      </LegalModal>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
  },
  versionLabel: {
    color: '#9ba5bf',
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    color: '#9ba5bf',
    marginTop: 4,
    marginBottom: 4,
  },
  modalSectionHeading: {
    color: '#d9dff8',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
  },
  helpSectionHeading: {
    marginTop: 16,
  },
  inlineLinks: {
    gap: 8,
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242c3c',
    backgroundColor: '#111725',
  },
  inlineLinkLabel: {
    color: '#dfe6ff',
    fontWeight: '500',
  },
  inlineLinkArrow: {
    color: '#8c95b6',
    fontSize: 18,
  },
  versionMetaWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  versionMetaLabel: {
    color: '#9aa2c5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  versionMetaValue: {
    color: '#f4f6ff',
    fontSize: 16,
    fontWeight: '600',
  },
  legalParagraph: {
    color: '#d8deff',
    marginBottom: 12,
    lineHeight: 20,
  },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2434',
  },
  licenseName: {
    color: '#eff1ff',
    fontWeight: '500',
  },
  licenseVersion: {
    color: '#9ba3c5',
  },
});
