import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Props passed to custom icon renderers supplied to {@link IconButton}.
 */
export interface IconButtonRenderIconProps {
  /** Color resolved for the icon. */
  color: string;
  /** Icon size in pixels. */
  size: number;
  /** Indicates whether the parent button is disabled. */
  disabled: boolean;
}

/**
 * Props for the {@link IconButton} component.
 */
export interface IconButtonProps {
  /** Icon glyph name (family defined via `iconFamily`). */
  name?: FeatherName | MaterialIconName;
  /** Press callback handler. */
  onPress?: () => void;
  /** Disables the button when true. */
  disabled?: boolean;
  /** Icon size applied to built-in icons. */
  size?: number;
  /** Icon tint color. */
  color?: string;
  /** Extra styles merged into container. */
  style?: ViewStyle;
  /** Accessibility label for screen readers. */
  accessibilityLabel?: string;
  /** Styles applied directly to the icon. */
  iconStyle?: StyleProp<TextStyle>;
  /** Icon set to use (Material or Feather). */
  iconFamily?: 'feather' | 'material';
  /** Render prop for injecting custom icons. */
  renderIcon?: (props: IconButtonRenderIconProps) => React.ReactNode;
}

/**
 * Small adaptable button that renders Feather or Material icons.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  disabled,
  size = 20,
  color,
  style,
  accessibilityLabel,
  iconStyle,
  iconFamily = 'material',
  renderIcon,
}) => {
  const colorScheme = useColorScheme();
  const defaultColor = colorScheme === 'light' ? '#1f2937' : '#f4f7ff';
  const resolvedColor = color ?? defaultColor;
  const iconColor = disabled ? '#6b7280' : resolvedColor;
  const icon =
    renderIcon?.({ color: iconColor, size, disabled: Boolean(disabled) }) ??
    (iconFamily === 'material' ? (
      <MaterialIcons
        name={(name as MaterialIconName) ?? 'circle'}
        size={size}
        color={iconColor}
        style={iconStyle}
      />
    ) : (
      <Feather
        name={(name as FeatherName) ?? 'circle'}
        size={size}
        color={iconColor}
        style={iconStyle}
      />
    ));
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, style, disabled && styles.disabled]}
    >
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  disabled: {
    opacity: 0.4,
  },
});
