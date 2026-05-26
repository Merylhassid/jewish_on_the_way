import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  color?: string;
}

export default function HomeButton({ color = 'rgba(255,255,255,0.85)' }: Props) {
  return (
    <Pressable style={styles.btn} onPress={() => router.replace('/(tabs)')} hitSlop={12}>
      <Text style={[styles.icon, { color }]}>🏠</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { position: 'absolute', top: 62, right: 20 },
  icon: { fontSize: 22 },
});
