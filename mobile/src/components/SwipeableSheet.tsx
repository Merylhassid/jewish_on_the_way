import { useRef } from 'react';
import {
  Animated, Modal, PanResponder,
  Pressable, StyleSheet, View,
} from 'react-native';
import { C } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: `${number}%` | number;
}

export default function SwipeableSheet({ visible, onClose, children, maxHeight = '92%' }: Props) {
  const dragY = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      // Only capture vertical downward swipes on the handle
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && gs.dy > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 110 || gs.vy > 0.5) {
          // Snap away then close
          Animated.timing(dragY, {
            toValue: 600, duration: 220, useNativeDriver: true,
          }).start(() => { dragY.setValue(0); onClose(); });
        } else {
          // Snap back
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Tap overlay to dismiss */}
      <Pressable style={s.overlay} onPress={onClose} />

      <Animated.View style={[s.sheet, { maxHeight }, { transform: [{ translateY: dragY }] }]}>
        {/* Drag handle — swipe area */}
        <View {...pan.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)' },
  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: '#D1C4A0',
  },
});
