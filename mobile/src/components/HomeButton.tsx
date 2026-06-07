import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home } from 'lucide-react-native';
import { C } from '@/constants/theme';

export default function HomeButton() {
  const goHome = async () => {
    await AsyncStorage.removeItem('lastDestinationId');
    router.replace('/(tabs)');
  };

  return (
    <Pressable
      style={({ pressed }) => [s.btn, pressed && { opacity: 0.75 }]}
      onPress={goHome}
      hitSlop={10}
    >
      <Home size={18} color={C.gold} strokeWidth={2} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 38,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
