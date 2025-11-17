import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { SpriteAnimationsMeta } from '../../SpriteAnimator';
import type { SpriteEditorFrame } from '../types';
import { IconButton } from './IconButton';
import { TimelineControls } from './TimelineControls';

const TIMELINE_CARD_SIZE = 150;
const TIMELINE_CARD_PADDING = 10;
const TIMELINE_FOOTER_HEIGHT = 28;

export interface FrameImageInfo {
  width: number;
  height: number;
  ready: boolean;
}

export interface TimelineSequenceCard {
  frame: SpriteEditorFrame | undefined;
  frameIndex: number;
  timelineIndex: number;
  isSelected: boolean;
}

export interface MultiplierFieldHandle {
  commit: () => void;
}

interface MultiplierFieldProps {
  value: number;
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

const MultiplierField = React.forwardRef<MultiplierFieldHandle, MultiplierFieldProps>(
  ({ value, onSubmit, disabled }, ref) => {
    const [draft, setDraft] = useState(String(value));
    const [isFocused, setFocused] = useState(false);

    const commit = useCallback(() => {
      const parsed = Number.parseFloat(draft);
      if (!Number.isFinite(parsed)) {
        setDraft(String(value));
        return;
      }
      onSubmit(parsed);
    }, [draft, onSubmit, value]);

    React.useImperativeHandle(ref, () => ({
      commit,
    }));

    React.useEffect(() => {
      if (!isFocused) {
        setDraft(String(value));
      }
    }, [isFocused, value]);

    return (
      <View style={styles.multiplierRow}>
        <Text style={styles.multiplierLabel}>Multiplier</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          keyboardType="numeric"
          style={[styles.multiplierInput, disabled && styles.multiplierInputDisabled]}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onSubmitEditing={() => {
            commit();
          }}
          returnKeyType="done"
        />
        <Text style={styles.multiplierUnit}>×</Text>
      </View>
    );
  },
);

MultiplierField.displayName = 'MultiplierField';

export interface TimelinePanelProps {
  title?: string;
  isPlaying: boolean;
  hasActiveAnimation: boolean;
  currentSequenceLength: number;
  currentAnimationName: string | null;
  sequenceCards: TimelineSequenceCard[];
  selectedTimelineIndex: number | null;
  selectedMultiplier: number;
  selectedFrame: SpriteEditorFrame | null;
  hasClipboard: boolean;
  defaultFrameMultiplier: number;
  timelineMeasuredHeight: number;
  onTimelineMeasured: (height: number) => void;
  onPlayFromSelection: () => void;
  onReverseFromSelection: () => void;
  onRestartForward: () => void;
  onRestartReverse: () => void;
  onPause: () => void;
  onStop: () => void;
  onOpenFramePicker: () => void;
  onOpenImagePicker: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  onSelectFrame: (timelineIndex: number) => void;
  multiplierRef: React.RefObject<MultiplierFieldHandle | null>;
  onSubmitMultiplier: (value: number) => void;
  timelineImageSource?: ImageSourcePropType;
  frameImageInfos: Record<string, FrameImageInfo>;
  fallbackImageInfo: FrameImageInfo | null;
  animationsMeta: SpriteAnimationsMeta;
}

export const TimelinePanel = ({
  title = 'Animation Frames',
  isPlaying,
  hasActiveAnimation,
  currentSequenceLength,
  currentAnimationName,
  sequenceCards,
  selectedTimelineIndex,
  selectedMultiplier,
  selectedFrame,
  hasClipboard,
  defaultFrameMultiplier,
  timelineMeasuredHeight,
  onTimelineMeasured,
  onPlayFromSelection,
  onReverseFromSelection,
  onRestartForward,
  onRestartReverse,
  onPause,
  onStop,
  onOpenFramePicker,
  onOpenImagePicker,
  onCopy,
  onPaste,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onSelectFrame,
  multiplierRef,
  onSubmitMultiplier,
  timelineImageSource,
  frameImageInfos,
  fallbackImageInfo,
  animationsMeta,
}: TimelinePanelProps) => {
  const renderRestartForwardIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <View style={styles.restartIcon}>
        <View style={[styles.restartIconBar, { backgroundColor: color, height: size }]} />
        <MaterialIcons name="play-arrow" size={size} color={color} />
      </View>
    ),
    [],
  );

  const renderRestartReverseIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <View style={[styles.restartIcon, styles.restartIconReverse]}>
        <View style={[styles.restartIconBar, { backgroundColor: color, height: size }]} />
        <MaterialIcons name="play-arrow" size={size} color={color} style={styles.reverseIcon} />
      </View>
    ),
    [],
  );

  const handleLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const { height } = event.nativeEvent.layout;
      if (height > 0 && Math.abs(height - timelineMeasuredHeight) > 1) {
        onTimelineMeasured(height);
      }
    },
    [onTimelineMeasured, timelineMeasuredHeight],
  );
  const renderTimelineCard = useCallback(
    (card: TimelineSequenceCard) => {
      const { frame, frameIndex, timelineIndex, isSelected } = card;
      const viewportSize = TIMELINE_CARD_SIZE - TIMELINE_FOOTER_HEIGHT - TIMELINE_CARD_PADDING * 2;
      const frameScale = frame ? viewportSize / Math.max(frame.w, frame.h) : 1;
      const storedMultiplier =
        currentAnimationName !== null && currentAnimationName !== undefined
          ? animationsMeta[currentAnimationName]?.multipliers?.[timelineIndex]
          : undefined;
      const computedMultiplier =
        typeof storedMultiplier === 'number' ? storedMultiplier : defaultFrameMultiplier;
      const multiplierLabel =
        Math.abs(computedMultiplier - 1) < 0.01 ? '' : ` [×${computedMultiplier.toFixed(2)}]`;

      const resolvePlaceholder = () => (
        <View
          style={[
            styles.thumb,
            styles.thumbPlaceholder,
            { width: viewportSize, height: viewportSize },
          ]}
        >
          <Text style={styles.thumbPlaceholderText}>No Image</Text>
        </View>
      );

      const renderThumb = () => {
        if (!frame) {
          return resolvePlaceholder();
        }
        const frameSource = frame.imageUri ? { uri: frame.imageUri } : timelineImageSource;
        const frameInfo = frame.imageUri ? frameImageInfos[frame.imageUri] : fallbackImageInfo;
        if (!frameSource || !frameInfo || !frameInfo.ready) {
          return resolvePlaceholder();
        }
        return (
          <View
            style={[
              styles.thumb,
              {
                width: viewportSize,
                height: viewportSize,
              },
            ]}
          >
            <View
              style={{
                width: frame.w * frameScale,
                height: frame.h * frameScale,
                overflow: 'hidden',
              }}
            >
              <Image
                source={frameSource}
                resizeMode="cover"
                style={{
                  width: (frameInfo.width || frame.w) * frameScale,
                  height: (frameInfo.height || frame.h) * frameScale,
                  transform: [
                    { translateX: -frame.x * frameScale },
                    { translateY: -frame.y * frameScale },
                  ],
                }}
              />
            </View>
          </View>
        );
      };

      return (
        <TouchableOpacity
          key={`${frameIndex}-${timelineIndex}`}
          style={[styles.timelineCard, isSelected && styles.timelineCardSelected]}
          onPress={() => onSelectFrame(timelineIndex)}
        >
          <View style={styles.timelineCardBody}>{renderThumb()}</View>
          <View style={styles.timelineCardFooter}>
            <Text style={styles.timelineCardMeta}>
              {timelineIndex}
              {typeof frameIndex === 'number' ? ` f${frameIndex}` : ''}
              {multiplierLabel}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [
      animationsMeta,
      currentAnimationName,
      defaultFrameMultiplier,
      fallbackImageInfo,
      frameImageInfos,
      onSelectFrame,
      timelineImageSource,
    ],
  );

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      onPause();
    } else {
      onStop();
    }
  }, [isPlaying, onPause, onStop]);

  const trackContent = useMemo(() => {
    if (!sequenceCards.length) {
      return <View style={styles.emptyTimelineWrapper} />;
    }
    return (
      <ScrollView
        horizontal
        style={styles.timelineScroll}
        contentContainerStyle={styles.timelineContent}
        showsHorizontalScrollIndicator={false}
      >
        {sequenceCards.map((card) => renderTimelineCard(card))}
      </ScrollView>
    );
  }, [renderTimelineCard, sequenceCards]);

  return (
    <View style={styles.timelineColumn} onLayout={handleLayout}>
      <View style={styles.timelineHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.timelineToolbar}>
        <View style={styles.timelineButtons}>
          <IconButton
            iconFamily="material"
            name="play-arrow"
            onPress={onReverseFromSelection}
            disabled={isPlaying || currentSequenceLength === 0}
            accessibilityLabel="Play animation in reverse"
            iconStyle={styles.reverseIcon}
          />
          <IconButton
            renderIcon={renderRestartReverseIcon}
            onPress={onRestartReverse}
            disabled={currentSequenceLength === 0}
            accessibilityLabel="Restart animation in reverse from beginning"
          />
          <IconButton
            iconFamily="material"
            name={isPlaying ? 'pause' : 'stop'}
            onPress={togglePlayback}
            disabled={!hasActiveAnimation || !currentSequenceLength}
            accessibilityLabel={isPlaying ? 'Pause animation preview' : 'Stop animation preview'}
          />
          <IconButton
            renderIcon={renderRestartForwardIcon}
            onPress={onRestartForward}
            disabled={currentSequenceLength === 0}
            accessibilityLabel="Restart animation from beginning"
          />
          <IconButton
            iconFamily="material"
            name="play-arrow"
            onPress={onPlayFromSelection}
            disabled={isPlaying || currentSequenceLength === 0}
            accessibilityLabel="Play animation preview"
          />
          <View style={styles.timelineDivider} />
          <IconButton
            name="insert-photo"
            onPress={onOpenImagePicker}
            disabled={!hasActiveAnimation || isPlaying}
            accessibilityLabel="Import image as frame"
          />
          <IconButton
            name="grid-on"
            onPress={onOpenFramePicker}
            disabled={!hasActiveAnimation || isPlaying}
            accessibilityLabel="Open frame picker modal"
          />
          <View style={styles.timelineDivider} />
          <TimelineControls
            isPlaying={isPlaying}
            selectedTimelineIndex={selectedTimelineIndex}
            currentSequenceLength={currentSequenceLength}
            hasClipboard={hasClipboard}
            onCopy={onCopy}
            onPaste={onPaste}
            onMoveLeft={onMoveLeft}
            onMoveRight={onMoveRight}
            onRemove={onRemove}
          />
        </View>
        <View style={styles.timelineDivider} />
        <MultiplierField
          ref={multiplierRef}
          value={selectedMultiplier}
          disabled={isPlaying || !selectedFrame}
          onSubmit={onSubmitMultiplier}
        />
      </View>
      <View style={styles.timelineTrack}>{trackContent}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  timelineColumn: {
    flex: 1,
    minWidth: 320,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#dfe7ff',
    fontWeight: '600',
  },
  timelineToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  timelineButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 4,
  },
  restartIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  restartIconReverse: {
    flexDirection: 'row-reverse',
  },
  restartIconBar: {
    width: 2,
    borderRadius: 1,
  },
  reverseIcon: {
    transform: [{ scaleX: -1 }],
  },
  timelineDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 0,
    marginRight: 8,
  },
  timelineScroll: {
    flexGrow: 1,
  },
  timelineContent: {
    flexDirection: 'row',
    paddingBottom: 6,
  },
  timelineCard: {
    width: TIMELINE_CARD_SIZE,
    height: TIMELINE_CARD_SIZE,
    padding: TIMELINE_CARD_PADDING,
    backgroundColor: '#141925',
  },
  timelineCardSelected: {
    backgroundColor: '#1c2441',
  },
  timelineCardBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCardFooter: {
    height: TIMELINE_FOOTER_HEIGHT,
    justifyContent: 'center',
  },
  thumb: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0f1321',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  thumbPlaceholderText: {
    color: '#6f7896',
    fontSize: 10,
  },
  timelineCardMeta: {
    color: '#a3acc7',
    fontSize: 12,
    textAlign: 'center',
  },
  multiplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  multiplierLabel: {
    color: '#7d86a0',
    fontSize: 11,
  },
  multiplierInput: {
    width: 64,
    textAlign: 'left',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b3246',
    color: '#fff',
    backgroundColor: '#191f2e',
  },
  multiplierInputDisabled: {
    opacity: 0.5,
  },
  multiplierUnit: {
    color: '#8a92ae',
    fontSize: 11,
  },
  emptyTimelineWrapper: {
    flex: 1,
    width: '100%',
    minHeight: TIMELINE_CARD_SIZE + TIMELINE_CARD_PADDING * 2,
  },
  timelineTrack: {
    width: '100%',
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22293a',
    backgroundColor: '#0f1321',
    padding: 12,
    minHeight: TIMELINE_CARD_SIZE + TIMELINE_CARD_PADDING * 2 + 24,
  },
});
