import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface IconButtonRenderIconProps {
  color: string;
  size: number;
  disabled: boolean;
}

export interface IconButtonProps {
  name?: FeatherName | MaterialIconName;
  onPress?: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
  iconStyle?: StyleProp<TextStyle>;
  iconFamily?: 'feather' | 'material';
  renderIcon?: (props: IconButtonRenderIconProps) => React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  disabled,
  size = 20,
  color = '#f4f7ff',
  style,
  accessibilityLabel,
  iconStyle,
  iconFamily = 'material',
  renderIcon,
}) => {
  const iconColor = disabled ? '#6b7280' : color;
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
