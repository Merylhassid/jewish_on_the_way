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

export function RestaurantCardSkeleton() {
  return (
    <View style={s.row}>
      <View style={s.accent} />
      <View style={s.body}>
        <View style={s.cardTop}>
          <Skeleton width={36} height={36} borderRadius={10} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="65%" height={13} />
            <Skeleton width="28%" height={11} />
          </View>
          <Skeleton width={62} height={26} borderRadius={8} />
        </View>
        <Skeleton width="78%" height={11} style={{ marginTop: 2 }} />
        <Skeleton width="48%" height={11} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function SynagogueCardSkeleton() {
  return (
    <View style={s.row}>
      <View style={[s.accent, { backgroundColor: '#7C3AED22' }]} />
      <View style={s.body}>
        <View style={s.cardTop}>
          <Skeleton width={36} height={36} borderRadius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={13} />
            <Skeleton width="22%" height={20} borderRadius={8} />
          </View>
          <Skeleton width={48} height={22} borderRadius={10} />
        </View>
        <Skeleton width="72%" height={11} style={{ marginTop: 2 }} />
      </View>
    </View>
  );
}

export function DestinationCardSkeleton({ width }: { width?: number }) {
  return (
    <View style={[s.destCard, width ? { width } : {}]}>
      <Skeleton height={160} borderRadius={20} />
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: '#E5E7EB' },

  row: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  accent:  { width: 4, backgroundColor: '#E5E7EB' },
  body:    { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  destCard: { marginBottom: 12 },
  card:     { marginBottom: 12 },
});
