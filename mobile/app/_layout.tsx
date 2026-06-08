import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/src/i18n';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home } from 'lucide-react-native';
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
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { C } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// Screens where HomeButton should NOT appear
const NO_HOME_PATHS = new Set([
  '/', '/compass', '/nearby', '/shabbat', '/profile',
  '/login', '/register', '/forgot-password', '/reset-password', '/onboarding',
]);

function FloatingHomeButton() {
  const pathname = usePathname();
  if (NO_HOME_PATHS.has(pathname)) return null;

  const goHome = async () => {
    await AsyncStorage.removeItem('lastDestinationId');
    router.replace('/(tabs)');
  };

  return (
    <Pressable
      style={({ pressed }) => [s.homeBtn, pressed && { opacity: 0.72 }]}
      onPress={goHome}
      hitSlop={10}
    >
      <Home size={18} color={C.gold} strokeWidth={2} />
    </Pressable>
  );
}

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

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.requestId) {
        router.push('/hosting/my-requests');
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1 }}>
            {isOffline && (
              <View style={s.offlineBanner}>
                <Text style={s.offlineText}>No internet connection</Text>
              </View>
            )}
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            >
              <Stack.Screen name="(auth)"                         options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)"                         options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="destination/[id]"              options={{ headerShown: false }} />
              <Stack.Screen name="destination/[id]/subdestinations" options={{ headerShown: false }} />
              <Stack.Screen name="synagogues/[destinationId]"    options={{ headerShown: false }} />
              <Stack.Screen name="synagogue/[id]"                options={{ headerShown: false }} />
              <Stack.Screen name="restaurants/[destinationId]"   options={{ headerShown: false }} />
              <Stack.Screen name="restaurant/[id]"               options={{ headerShown: false }} />
              <Stack.Screen name="chat/[destinationId]"          options={{ headerShown: false }} />
              <Stack.Screen name="minyans/[destinationId]"       options={{ headerShown: false }} />
              <Stack.Screen name="minyan/[id]"                   options={{ headerShown: false }} />
              <Stack.Screen name="hosting/[destinationId]"       options={{ headerShown: false }} />
              <Stack.Screen name="hosting/my-requests"           options={{ headerShown: false }} />
              <Stack.Screen name="hosting/my-offers"             options={{ headerShown: false }} />
              <Stack.Screen name="hosting/chat/[requestId]"      options={{ headerShown: false }} />
              <Stack.Screen name="saved"                          options={{ headerShown: false }} />
              <Stack.Screen name="map/[destinationId]"           options={{ headerShown: false }} />
            </Stack>

            {/* Floating home button — visible on all non-tab / non-auth screens */}
            <FloatingHomeButton />
            <StatusBar style="auto" />
          </View>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  offlineBanner: { backgroundColor: '#EF4444', padding: 8, alignItems: 'center' },
  offlineText:   { color: '#fff', fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  homeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 38,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.50)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 20,
  },
});
