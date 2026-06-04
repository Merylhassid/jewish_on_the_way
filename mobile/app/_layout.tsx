import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/src/store/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isOffline, setIsOffline] = useState(false);

  const [fontsLoaded] = useFonts({
    'Inter-Regular':   Inter_400Regular,
    'Inter-Medium':    Inter_500Medium,
    'Inter-SemiBold':  Inter_600SemiBold,
    'Inter-Bold':      Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
    'Inter-Black':     Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => setIsOffline(!state.isConnected));
    return unsub;
  }, []);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {isOffline && (
          <View style={{ backgroundColor: '#EF4444', padding: 8, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontFamily: 'Inter-SemiBold' }}>
              No internet connection
            </Text>
          </View>
        )}
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="destination/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="destination/[id]/subdestinations" options={{ headerShown: false }} />
          <Stack.Screen name="synagogues/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="synagogue/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="restaurants/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="restaurant/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="minyans/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="minyan/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/my-requests" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/my-offers" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/chat/[requestId]" options={{ headerShown: false }} />
          <Stack.Screen name="saved" options={{ headerShown: false }} />
          <Stack.Screen name="map/[destinationId]" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
