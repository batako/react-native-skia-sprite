import React from 'react';
import { Asset } from 'expo-asset';
import {
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AnimatedSprite2D,
  type SpriteEditorFrame,
  type SpriteEditorState,
  type SpriteFramesResource,
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
  homepage?: string;
  publisher?: string;
  email?: string;
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

const ABOUT_SAMPLE_ANIMATION = 'walk';
const aboutSampleAnimationsMeta: SpriteFramesResource['animationsMeta'] =
  SAMPLE_INITIAL_STATE.animationsMeta
    ? JSON.parse(JSON.stringify(SAMPLE_INITIAL_STATE.animationsMeta))
    : {};
if (!aboutSampleAnimationsMeta[ABOUT_SAMPLE_ANIMATION]) {
  aboutSampleAnimationsMeta[ABOUT_SAMPLE_ANIMATION] = {
    loop: true,
    fps: 1,
    multipliers: createDefaultMultipliers(
      SAMPLE_INITIAL_STATE.animations?.[ABOUT_SAMPLE_ANIMATION]?.length ?? 0,
    ),
  };
} else {
  aboutSampleAnimationsMeta[ABOUT_SAMPLE_ANIMATION]!.fps = 1;
}
const ABOUT_SAMPLE_RESOURCE: SpriteFramesResource = {
  frames: SAMPLE_FRAMES.map((frame) => ({
    id: frame.id,
    width: frame.w,
    height: frame.h,
    duration: frame.duration,
    image: {
      type: 'require',
      assetId: SAMPLE_SPRITE as number,
      subset:
        typeof frame.x === 'number' && typeof frame.y === 'number'
          ? { x: frame.x, y: frame.y, width: frame.w, height: frame.h }
          : undefined,
    },
  })),
  animations: SAMPLE_INITIAL_STATE.animations ?? {},
  animationsMeta: aboutSampleAnimationsMeta,
  autoPlayAnimation: SAMPLE_INITIAL_STATE.autoPlayAnimation ?? ABOUT_SAMPLE_ANIMATION,
  meta: SAMPLE_INITIAL_STATE.meta ?? {},
};

/**
 * The standalone editor demo screen that wires up AnimationStudio.
 */
export const EditorScreen = () => {
  const editor = useSpriteEditor({
    historyLimit: 100,
    trackSelectionInHistory: true,
    initialState: __DEV__ ? SAMPLE_INITIAL_STATE : undefined,
  });
  const integration = useEditorIntegration({ editor });
  const strings = React.useMemo(() => getEditorStrings(), []);
  const legalStrings = strings.editorScreen;

  const [imageSource, setImageSource] = React.useState<DataSourceParam>(SAMPLE_SPRITE);
  const editorRef = React.useRef(editor);
  const [legalModalView, setLegalModalView] = React.useState<
    'overview' | 'about' | 'terms' | 'privacy' | 'licenses'
  >('overview');
  const [isLegalModalVisible, setLegalModalVisible] = React.useState(false);
  const handleLegalModalClose = React.useCallback(() => {
    if (legalModalView === 'overview') {
      setLegalModalVisible(false);
      return;
    }
    setLegalModalView('overview');
  }, [legalModalView, setLegalModalView, setLegalModalVisible]);
  const handleOpenLink = React.useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      // ignore
    });
  }, []);
  const legalModalTitle = React.useMemo(() => {
    switch (legalModalView) {
      case 'about':
        return legalStrings.infoAppHeading;
      case 'terms':
        return legalStrings.termsTitle;
      case 'privacy':
        return legalStrings.privacyTitle;
      case 'licenses':
        return legalStrings.licensesTitle;
      default:
        return legalStrings.infoCenterTitle;
    }
  }, [legalModalView, legalStrings]);
  const renderLegalModalContent = React.useCallback(() => {
    switch (legalModalView) {
      case 'about':
        return (
          <>
            <Text style={styles.legalParagraph}>{legalStrings.infoAppDescription}</Text>
            <Text style={styles.legalParagraph}>{legalStrings.infoAppModuleNote}</Text>
            <Text style={styles.legalParagraph}>{legalStrings.infoAppJsonUsage}</Text>
            <Text style={styles.modalSectionHeading}>{legalStrings.infoAppSampleHeading}</Text>
            <View style={styles.sampleCard}>
      <Text style={styles.sampleCardDescription}>
        {legalStrings.infoAppSampleDescription}
      </Text>
      <Text style={styles.sampleLabel}>{legalStrings.infoAppSampleCodeLabel}</Text>
      <View style={styles.codeBlock}>
        <Text style={styles.codeText}>{legalStrings.infoAppSampleCode}</Text>
      </View>
      <Text style={styles.sampleLabel}>{legalStrings.infoAppSamplePreviewLabel}</Text>
              <View style={styles.samplePreview}>
                <AnimatedSprite2D
                  frames={ABOUT_SAMPLE_RESOURCE}
                  animation={ABOUT_SAMPLE_ANIMATION}
                  autoplay={ABOUT_SAMPLE_ANIMATION}
                  centered
                />
              </View>
            </View>
          </>
        );
      case 'terms':
        return (
          <>
            <Text style={styles.legalParagraph}>{legalStrings.termsBodyIntro}</Text>
            <Text style={styles.legalParagraph}>{legalStrings.termsBodyUse}</Text>
            <Text style={styles.legalParagraph}>{legalStrings.termsBodyContact}</Text>
          </>
        );
      case 'privacy':
        return (
          <>
            <Text style={styles.legalParagraph}>{legalStrings.privacyBodyIntro}</Text>
            <Text style={styles.legalParagraph}>{legalStrings.privacyBodyContact}</Text>
          </>
        );
      case 'licenses':
        return (
          <>
            <Text style={styles.legalParagraph}>{legalStrings.licensesIntro}</Text>
            <View style={styles.licenseList}>
              {licenseEntries.map((entry) => {
                const repository = entry.repository?.trim() ?? '';
                const homepage = entry.homepage?.trim() ?? '';
                const showHomepage = Boolean(homepage && homepage !== repository);
                const publisher = entry.publisher?.trim() ?? '';
                const email = entry.email?.trim() ?? '';
                const contactLine = [publisher, email ? `<${email}>` : '']
                  .filter(Boolean)
                  .join(' ');
                const licenseTokens = entry.licenses
                  ? entry.licenses.split(',').map((token) => token.trim()).filter(Boolean)
                  : [];
                return (
                  <View key={`${entry.name}@${entry.version}`} style={styles.licenseCard}>
                    <View style={styles.licenseCardHeader}>
                      <Text style={styles.licenseName}>
                        {entry.name}
                        <Text style={styles.licenseVersion}>{` v${entry.version}`}</Text>
                      </Text>
                      {licenseTokens.length > 0 && (
                        <View style={styles.licenseBadges}>
                          {licenseTokens.map((token, index) => (
                            <View
                              key={`${entry.name}-${token}-${index}`}
                              style={styles.licenseBadge}
                            >
                              <Text style={styles.licenseBadgeLabel}>{token}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    {!!contactLine && (
                      <Text style={styles.licenseContactLine} numberOfLines={1}>
                        {contactLine}
                      </Text>
                    )}
                    {(repository || showHomepage) && (
                      <View style={styles.licenseLinks}>
                        {!!repository && (
                          <Pressable
                            style={styles.licenseLinkButton}
                            onPress={() => handleOpenLink(repository)}
                            accessibilityRole="link"
                          >
                            <Text style={styles.licenseLinkLabel} numberOfLines={1}>
                              {repository}
                            </Text>
                            <Text style={styles.licenseLinkArrow}>↗</Text>
                          </Pressable>
                        )}
                        {!!showHomepage && homepage && (
                          <Pressable
                            style={styles.licenseLinkButton}
                            onPress={() => handleOpenLink(homepage)}
                            accessibilityRole="link"
                          >
                            <Text style={styles.licenseLinkLabel} numberOfLines={1}>
                              {homepage}
                            </Text>
                            <Text style={styles.licenseLinkArrow}>↗</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        );
      case 'overview':
        return (
          <>
            <Text style={styles.modalSectionHeading}>{legalStrings.infoAppSectionHeading}</Text>
            <View style={styles.inlineLinks}>
              <Pressable
                style={styles.inlineLink}
                onPress={() => setLegalModalView('about')}
                accessibilityRole="button"
              >
                <Text style={styles.inlineLinkLabel}>{legalStrings.infoAppLinkLabel}</Text>
                <Text style={styles.inlineLinkArrow}>›</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSectionHeading}>{legalStrings.legalHeading}</Text>
            <Text style={styles.legalParagraph}>{legalStrings.legalOverviewIntro}</Text>
            <View style={styles.inlineLinks}>
              <Pressable
                style={styles.inlineLink}
                onPress={() => setLegalModalView('terms')}
                accessibilityRole="button"
              >
                <Text style={styles.inlineLinkLabel}>{legalStrings.termsTitle}</Text>
                <Text style={styles.inlineLinkArrow}>›</Text>
              </Pressable>
              <Pressable
                style={styles.inlineLink}
                onPress={() => setLegalModalView('privacy')}
                accessibilityRole="button"
              >
                <Text style={styles.inlineLinkLabel}>{legalStrings.privacyTitle}</Text>
                <Text style={styles.inlineLinkArrow}>›</Text>
              </Pressable>
              <Pressable
                style={styles.inlineLink}
                onPress={() => setLegalModalView('licenses')}
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
          </>
        );
      default:
        return null;
    }
  }, [legalModalView, legalStrings, handleOpenLink, setLegalModalView]);

  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  React.useEffect(() => {
    if (!__DEV__) {
      return;
    }
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
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>React Native Skia Sprite Animator</Text>
            <Text style={styles.versionLabel}>{`v${SPRITE_ANIMATOR_VERSION}`}</Text>
          </View>
          <IconButton
            iconFamily="material"
            name="info-outline"
            onPress={() => {
              setLegalModalView('overview');
              setLegalModalVisible(true);
            }}
            accessibilityLabel={legalStrings.infoCenterTitle}
          />
        </View>
        <Text style={styles.subtitle}>{strings.editorScreen.subtitle}</Text>
        <AnimationStudio editor={editor} integration={integration} image={imageSource} />
      </View>
      <LegalModal
        title={legalModalTitle}
        visible={isLegalModalVisible}
        onClose={handleLegalModalClose}
      >
        {renderLegalModalContent()}
      </LegalModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080b12',
  },
  content: {
    padding: 20,
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
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  versionMetaValue: {
    color: '#f4f6ff',
    fontSize: 13,
    fontWeight: '600',
  },
  legalParagraph: {
    color: '#d8deff',
    marginBottom: 12,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: '#05070f',
    borderWidth: 1,
    borderColor: '#1c2538',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  codeText: {
    color: '#e7ecff',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'Courier',
    }),
    fontSize: 12,
    lineHeight: 18,
  },
  sampleCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1d2639',
    backgroundColor: '#0a0f1d',
    padding: 14,
    marginBottom: 20,
  },
  sampleCardDescription: {
    color: '#cfd7f2',
    marginBottom: 12,
    lineHeight: 20,
  },
  sampleLabel: {
    color: '#9fb2ff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 6,
  },
  samplePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  licenseList: {
    gap: 12,
  },
  licenseCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1b2438',
    backgroundColor: '#0d1422',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  licenseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  licenseName: {
    color: '#f3f6ff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  licenseVersion: {
    color: '#9ba5c7',
    fontSize: 12,
    fontWeight: '600',
  },
  licenseBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: '40%',
  },
  licenseBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#273552',
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: '#151f33',
  },
  licenseBadgeLabel: {
    color: '#a9c2ff',
    fontSize: 11,
    fontWeight: '500',
  },
  licenseContactLine: {
    marginTop: 10,
    color: '#9aa3c9',
    fontSize: 12,
  },
  licenseLinks: {
    marginTop: 12,
    gap: 8,
  },
  licenseLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#25344f',
    backgroundColor: '#121b2c',
    gap: 8,
  },
  licenseLinkLabel: {
    color: '#8ac1ff',
    fontSize: 12,
    flex: 1,
  },
  licenseLinkArrow: {
    color: '#8ac1ff',
    fontSize: 12,
  },
});
