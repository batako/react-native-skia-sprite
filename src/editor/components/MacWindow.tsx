import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  StyleProp,
  ViewStyle,
  useColorScheme,
} from 'react-native';

const DOUBLE_TAP_DELAY_MS = 300;

/** Visual variants for the {@link MacWindow} chrome. */
export type MacWindowVariant = 'default' | 'compact' | 'fullscreen';

/**
 * Props for the {@link MacWindow} component.
 */
export interface MacWindowProps {
  /** Window title text. */
  title?: string;
  /** Forces a specific variant via props. */
  variant?: MacWindowVariant;
  /** Default variant when uncontrolled. */
  defaultVariant?: MacWindowVariant;
  /** Fires when the variant toggles. */
  onVariantChange?: (variant: MacWindowVariant) => void;
  /** Close button callback; defaults to resetting variant. */
  onClose?: () => void;
  /** Minimize button callback; defaults to toggling compact. */
  onMinimize?: () => void;
  /** Maximize button callback; defaults to toggling fullscreen. */
  onMaximize?: () => void;
  /** Triggered when the header is double-tapped. */
  onHeaderDoubleTap?: () => void;
  /** Optional toolbar content rendered below the header. */
  toolbarContent?: ReactNode;
  /** Window body children. */
  children?: ReactNode;
  /** Style overrides for the outer shell. */
  style?: StyleProp<ViewStyle>;
  /** Style overrides for the content body. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Style overrides for the toolbar area. */
  toolbarStyle?: StyleProp<ViewStyle>;
  /** Whether the compact/minimize button is available. */
  enableCompact?: boolean;
}

/**
 * Desktop-inspired floating window with title bar controls.
 */
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
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme !== 'light';
  const styles = useMemo(() => createThemedStyles(isDarkMode), [isDarkMode]);
  const lastHeaderTapRef = useRef(0);
  const [internalVariant, setInternalVariant] = useState<MacWindowVariant>(
    variant ?? defaultVariant,
  );
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
            style={[styles.windowDot, styles.windowDotMinimize]}
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

const baseStyles = {
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
} as const;

const COLOR_KEYS = new Set([
  'backgroundColor',
  'borderColor',
  'borderBottomColor',
  'borderTopColor',
  'borderLeftColor',
  'borderRightColor',
  'color',
]);

const lightColorMap: Record<string, string> = {
  '#1c2233': '#f6f7fb',
  '#2a3147': '#d1d7e4',
  '#151b2a': '#e8edf6',
  '#ff5f56': '#ef4444',
  '#ffbd2e': '#f59e0b',
  '#27c840': '#22c55e',
  '#e6ecff': '#0f172a',
};

const lightTextColorMap: Record<string, string> = {
  '#e6ecff': '#0f172a',
};

const mapStyleColors = (
  stylesObject: Record<string, any>,
  mapColor: (value: string, key: string) => string,
): Record<string, any> => {
  const next: Record<string, any> = {};
  Object.entries(stylesObject).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = mapStyleColors(value, mapColor);
      return;
    }
    if (typeof value === 'string' && COLOR_KEYS.has(key)) {
      next[key] = mapColor(value, key);
      return;
    }
    next[key] = value;
  });
  return next;
};

const createThemedStyles = (isDarkMode: boolean) => {
  const mapColor = (value: string, key: string) => {
    if (isDarkMode) {
      return value;
    }
    if (key === 'color') {
      return lightTextColorMap[value] ?? lightColorMap[value] ?? value;
    }
    return lightColorMap[value] ?? value;
  };
  return StyleSheet.create(mapStyleColors(baseStyles, mapColor));
};

export default MacWindow;
