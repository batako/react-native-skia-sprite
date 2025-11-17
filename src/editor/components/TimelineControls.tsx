import React from 'react';
import { View } from 'react-native';
import { IconButton } from './IconButton';

export interface TimelineControlsProps {
  isPlaying: boolean;
  selectedTimelineIndex: number | null;
  currentSequenceLength: number;
  hasClipboard: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
}

export const TimelineControls = ({
  isPlaying,
  selectedTimelineIndex,
  currentSequenceLength,
  hasClipboard,
  onCopy,
  onPaste,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: TimelineControlsProps) => {
  const canSelect = selectedTimelineIndex !== null;
  const canMoveLeft = canSelect && selectedTimelineIndex! > 0;
  const canMoveRight =
    canSelect && currentSequenceLength > 0 && selectedTimelineIndex! < currentSequenceLength - 1;
  const disableActions = isPlaying;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <IconButton
        name="content-copy"
        onPress={onCopy}
        disabled={disableActions || !canSelect}
        accessibilityLabel="Copy timeline frame"
      />
      <IconButton
        name="content-paste"
        onPress={onPaste}
        disabled={disableActions || !hasClipboard}
        accessibilityLabel="Paste timeline frame"
      />
      <IconButton
        name="skip-previous"
        onPress={onMoveLeft}
        disabled={disableActions || !canMoveLeft}
        accessibilityLabel="Move frame left"
      />
      <IconButton
        name="skip-next"
        onPress={onMoveRight}
        disabled={disableActions || !canMoveRight}
        accessibilityLabel="Move frame right"
      />
      <IconButton
        name="delete-forever"
        onPress={onRemove}
        disabled={disableActions || !canSelect}
        accessibilityLabel="Remove timeline frame"
      />
    </View>
  );
};
