import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/src/i18n';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/src/store/auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="destination/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="restaurants/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="restaurant/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="minyans/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="minyan/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/[destinationId]" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/my-requests" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/my-offers" options={{ headerShown: false }} />
          <Stack.Screen name="hosting/chat/[requestId]" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
