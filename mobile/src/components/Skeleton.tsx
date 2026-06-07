import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface Props {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[s.base, { width, height, borderRadius, opacity }, style]}
    />
  );
}

// Preset card skeleton
export function DestinationCardSkeleton() {
  return (
    <View style={s.card}>
      <Skeleton height={160} borderRadius={20} />
      <Skeleton width="60%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="40%" height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: '#E5E7EB' },
  card: { marginBottom: 12 },
});
