import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  color?: string;
}

export default function HomeButton({ color = 'rgba(255,255,255,0.85)' }: Props) {
  const goHome = async () => {
    await AsyncStorage.removeItem('lastDestinationId');
    router.replace('/(tabs)');
  };

  return (
    <Pressable style={styles.btn} onPress={goHome} hitSlop={12}>
      <Text style={[styles.icon, { color }]}>🏠</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { position: 'absolute', top: 62, right: 20 },
  icon: { fontSize: 22 },
});
