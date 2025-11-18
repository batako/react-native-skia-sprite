/* eslint-disable jsdoc/require-jsdoc */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SpriteAnimator } from '../../SpriteAnimator';
import type { DataSourceParam } from '@shopify/react-native-skia';
import type { EditorIntegration } from '../hooks/useEditorIntegration';

interface SpriteAnimatorDriverProps {
  integration: EditorIntegration;
  image: DataSourceParam;
}

export const SpriteAnimatorDriver = ({ integration, image }: SpriteAnimatorDriverProps) => {
  const {
    animatorRef,
    runtimeData,
    animationsMeta,
    speedScale,
    onFrameChange,
    onAnimationEnd,
    activeAnimation,
  } = integration;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <SpriteAnimator
        ref={animatorRef}
        image={image}
        data={runtimeData}
        animationsMeta={animationsMeta}
        speedScale={speedScale}
        initialAnimation={activeAnimation ?? undefined}
        onFrameChange={onFrameChange}
        onAnimationEnd={onAnimationEnd}
        style={styles.hidden}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
