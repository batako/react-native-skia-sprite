import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface InlineConfirmButtonProps extends Pick<AccessibilityProps, 'accessibilityLabel'> {
  visible: boolean;
  onPress: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const InlineConfirmButton = ({
  visible,
  onPress,
  accessibilityLabel = '',
  containerStyle,
}: InlineConfirmButtonProps) => {
  if (!visible) {
    return null;
  }
  return (
    <View pointerEvents="box-none" style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <MaterialIcons name="check" size={16} color="#0f172a" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -18 }],
    right: -36,
    zIndex: 20,
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
