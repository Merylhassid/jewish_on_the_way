import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/src/store/auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {isOffline && (
          <View style={{ backgroundColor: '#e74c3c', padding: 8, alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
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
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
