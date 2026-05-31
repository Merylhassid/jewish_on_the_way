import { Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { C } from '@/constants/theme';

interface Props {
  value: number;           // current value (0–5, may be fractional for display)
  onChange?: (v: number) => void;  // if provided → interactive
  size?: number;
  color?: string;
}

export default function StarRating({ value, onChange, size = 22, color = C.gold }: Props) {
  return (
    <View style={s.row}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= Math.round(value);
        return (
          <Pressable
            key={n}
            onPress={() => onChange?.(n)}
            hitSlop={6}
            disabled={!onChange}
          >
            <MaterialIcons
              name={filled ? 'star' : 'star-border'}
              size={size}
              color={filled ? color : '#D1C4A0'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
