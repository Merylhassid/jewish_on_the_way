import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/src/store/auth';

export default function TabLayout() {
  const { token, loading } = useAuth();

  // Show blank screen while restoring session
  if (loading) return <View style={{ flex: 1, backgroundColor: '#f0f4ff' }} />;

  // When token is cleared (logout), redirect to login
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#1a3a6b',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e8eef8' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Destinations',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="globe" color={color} />,
        }}
      />
      <Tabs.Screen
        name="compass"
        options={{
          title: 'Compass',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="location.north.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
