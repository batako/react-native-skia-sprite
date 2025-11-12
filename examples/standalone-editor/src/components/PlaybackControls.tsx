import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SpriteAnimator } from 'react-native-skia-sprite-animator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import type { EditorIntegration } from '../hooks/useEditorIntegration';
import { IconButton } from './IconButton';

export interface PlaybackControlsProps {
  integration: EditorIntegration;
  image: DataSourceParam;
}

export const PlaybackControls = ({ integration, image }: PlaybackControlsProps) => {
  const {
    animatorRef,
    runtimeData,
    availableAnimations,
    activeAnimation,
    setActiveAnimation,
    play,
    pause,
    stop,
    seekFrame,
    speedScale,
    setSpeedScale,
    isPlaying,
    frameCursor,
    onFrameChange,
    selectedFrameIndex,
  } = integration;

  const handleSelectAnimation = (name: string | null) => {
    setActiveAnimation(name);
    play(name);
  };

  const adjustSpeed = (delta: number) => {
    const next = Math.min(4, Math.max(0.25, Number((speedScale + delta).toFixed(2))));
    setSpeedScale(next);
    if (isPlaying) {
      play(activeAnimation);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Animator Preview</Text>
      <View style={styles.previewCard}>
        <SpriteAnimator
          ref={animatorRef}
          image={image}
          data={runtimeData}
          fps={12}
          loop
          speedScale={speedScale}
          onFrameChange={onFrameChange}
          style={styles.canvas}
        />
      </View>
      <View style={styles.buttonRow}>
        <IconButton
          name={isPlaying ? 'pause' : 'play'}
          onPress={() => (isPlaying ? pause() : play(activeAnimation))}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        />
        <IconButton name="square" onPress={stop} accessibilityLabel="Stop" />
        <IconButton
          name="target"
          onPress={() => selectedFrameIndex !== null && seekFrame(selectedFrameIndex)}
          disabled={selectedFrameIndex === null}
          accessibilityLabel="Seek selected frame"
        />
      </View>
      <View style={styles.buttonRow}>
        <IconButton
          name="minus"
          onPress={() => adjustSpeed(-0.25)}
          accessibilityLabel="Slow down"
        />
        <IconButton name="plus" onPress={() => adjustSpeed(0.25)} accessibilityLabel="Speed up" />
        <Text style={styles.speedLabel}>Speed ×{speedScale.toFixed(2)}</Text>
      </View>
      <Text style={styles.subheading}>Animations</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animationsRow}>
        <Pressable
          style={[styles.animationChip, !activeAnimation && styles.animationChipActive]}
          onPress={() => handleSelectAnimation(null)}
        >
          <Text style={styles.animationChipText}>All Frames</Text>
        </Pressable>
        {availableAnimations.map((name) => (
          <Pressable
            key={name}
            style={[styles.animationChip, activeAnimation === name && styles.animationChipActive]}
            onPress={() => handleSelectAnimation(name)}
          >
            <Text style={styles.animationChipText}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.statusText}>
        Frame cursor: {frameCursor} / {runtimeData.frames.length - 1}
      </Text>
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
    color: '#dfe7ff',
    fontWeight: '600',
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: '#0c0f15',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: 200,
    height: 200,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  speedLabel: {
    color: '#a5b0c5',
    alignSelf: 'center',
  },
  subheading: {
    color: '#a5b0c5',
    marginTop: 12,
    marginBottom: 4,
  },
  animationsRow: {
    flexGrow: 0,
  },
  animationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a3142',
  },
  animationChipActive: {
    backgroundColor: '#4f8dff33',
    borderColor: '#4f8dff',
  },
  animationChipText: {
    color: '#e5ecff',
    fontSize: 12,
  },
  statusText: {
    marginTop: 12,
    color: '#8a94ab',
    fontSize: 12,
  },
});
