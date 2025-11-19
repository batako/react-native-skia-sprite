/* eslint-disable jsdoc/require-jsdoc */
import React from 'react';
import {
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { IconButton } from './IconButton';

interface LegalModalProps {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ANIMATION_DURATION_MS = 280;

export const LegalModal = ({ title, visible, onClose, children }: LegalModalProps) => {
  const { width } = useWindowDimensions();
  const slideAnim = React.useRef(new Animated.Value(width)).current;
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }
  }, [visible]);

  React.useEffect(() => {
    if (!shouldRender) {
      return;
    }
    slideAnim.stopAnimation();
    if (visible) {
      slideAnim.setValue(width);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: ANIMATION_DURATION_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible, width, shouldRender, slideAnim]);

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal visible={shouldRender} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View
          style={[styles.slideWrapper, { transform: [{ translateX: slideAnim }] }]}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <IconButton name="close" onPress={onClose} accessibilityLabel="Close" />
            </View>
            <ScrollView style={styles.body}>{children}</ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  slideWrapper: {
    flex: 1,
    backgroundColor: '#080b12',
  },
  container: {
    flex: 1,
    backgroundColor: '#080b12',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2430',
  },
  title: {
    color: '#f5f6ff',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
