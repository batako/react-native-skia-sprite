import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

const DOUBLE_TAP_DELAY_MS = 300;

export type MacWindowVariant = 'default' | 'compact' | 'fullscreen';

export interface MacWindowProps {
  title?: string;
  variant?: MacWindowVariant;
  defaultVariant?: MacWindowVariant;
  onVariantChange?: (variant: MacWindowVariant) => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onHeaderDoubleTap?: () => void;
  toolbarContent?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  toolbarStyle?: StyleProp<ViewStyle>;
}

export const MacWindow = ({
  title = '',
  variant,
  defaultVariant = 'default',
  onVariantChange,
  onClose,
  onMinimize,
  onMaximize,
  onHeaderDoubleTap,
  toolbarContent,
  children,
  style,
  contentStyle,
  toolbarStyle,
  enableCompact = true,
}: MacWindowProps) => {
  const lastHeaderTapRef = useRef(0);
  const [internalVariant, setInternalVariant] = useState<MacWindowVariant>(variant ?? defaultVariant);
  const resolvedVariant = variant ?? internalVariant;
  const setVariant = useCallback(
    (next: MacWindowVariant) => {
      if (variant === undefined) {
        setInternalVariant(next);
      }
      onVariantChange?.(next);
    },
    [variant, onVariantChange],
  );

  useEffect(() => {
    if (variant !== undefined && variant !== internalVariant) {
      setInternalVariant(variant);
    }
  }, [variant, internalVariant]);

  const handleClosePress = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    setVariant('default');
  }, [onClose, setVariant]);

  const handleMinimizePress = useCallback(() => {
    if (!enableCompact) {
      return;
    }
    if (onMinimize) {
      onMinimize();
      return;
    }
    const next = resolvedVariant === 'compact' ? 'default' : 'compact';
    setVariant(next);
  }, [enableCompact, onMinimize, resolvedVariant, setVariant]);

  const handleMaximizePress = useCallback(() => {
    const next = resolvedVariant === 'fullscreen' ? 'default' : 'fullscreen';
    setVariant(next);
    onMaximize?.();
  }, [onMaximize, resolvedVariant, setVariant]);

  const handleHeaderTap = useCallback(() => {
    const now = Date.now();
    if (now - lastHeaderTapRef.current < DOUBLE_TAP_DELAY_MS) {
      lastHeaderTapRef.current = 0;
      if (onHeaderDoubleTap) {
        onHeaderDoubleTap();
      } else {
        const next = resolvedVariant === 'fullscreen' ? 'default' : 'fullscreen';
        setVariant(next);
      }
    } else {
      lastHeaderTapRef.current = now;
    }
  }, [onHeaderDoubleTap, resolvedVariant, setVariant]);


  return (
    <View
      style={[
        styles.window,
        resolvedVariant === 'compact' && styles.windowCompact,
        resolvedVariant === 'fullscreen' && styles.windowFullscreen,
        style,
      ]}
    >
      <Pressable style={styles.windowHeader} hitSlop={8} onPress={handleHeaderTap}>
        <View style={styles.windowDots}>
          <TouchableOpacity
            style={[styles.windowDot, styles.windowDotClose]}
            onPress={handleClosePress}
            accessibilityLabel="Close window"
          />
          <TouchableOpacity
            style={[
              styles.windowDot,
              styles.windowDotMinimize,
              !enableCompact && styles.windowDotDisabled,
            ]}
            onPress={enableCompact ? handleMinimizePress : undefined}
            disabled={!enableCompact}
            accessibilityLabel="Minimize window"
          />
          <TouchableOpacity
            style={[styles.windowDot, styles.windowDotExpand]}
            onPress={handleMaximizePress}
            accessibilityLabel="Toggle fullscreen"
          />
        </View>
        <Text style={styles.windowTitle}>{title}</Text>
        <View style={styles.windowHeaderSpacer} />
      </Pressable>
      {toolbarContent ? (
        <View style={[styles.windowToolbar, toolbarStyle]}>{toolbarContent}</View>
      ) : null}
      <View style={[styles.windowContent, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  window: {
    width: '90%',
    maxWidth: 640,
    maxHeight: '80%',
    minHeight: 420,
    backgroundColor: '#1c2233',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3147',
    overflow: 'hidden',
  },
  windowCompact: {
    width: 360,
    maxWidth: 360,
    minHeight: 220,
    maxHeight: 320,
  },
  windowFullscreen: {
    width: '96%',
    maxWidth: '96%',
    height: '92%',
    maxHeight: '92%',
    minHeight: 520,
    borderRadius: 12,
  },
  windowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#151b2a',
  },
  windowDots: {
    flexDirection: 'row',
    gap: 6,
  },
  windowDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  windowDotClose: {
    backgroundColor: '#ff5f56',
  },
  windowDotMinimize: {
    backgroundColor: '#ffbd2e',
  },
  windowDotExpand: {
    backgroundColor: '#27c840',
  },
  windowDotDisabled: {
    opacity: 0.4,
  },
  windowTitle: {
    flex: 1,
    color: '#e6ecff',
    textAlign: 'center',
    fontWeight: '600',
  },
  windowHeaderSpacer: {
    width: 48,
  },
  windowToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3147',
    gap: 8,
  },
  windowContent: {
    flex: 1,
    padding: 12,
    minHeight: 320,
  },
});

export default MacWindow;
