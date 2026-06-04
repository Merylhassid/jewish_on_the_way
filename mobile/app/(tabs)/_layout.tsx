import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Compass, Flame, MapPin, Navigation, User } from 'lucide-react-native';
import { useAuth } from '@/src/store/auth';
import { C } from '@/constants/theme';

export default function TabLayout() {
  const { token, loading } = useAuth();

  if (loading) return <View style={{ flex: 1, backgroundColor: C.cream }} />;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: '#BBC3D4',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F0EDE6',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <MapPin size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="compass"
        options={{
          title: 'Qibla',
          tabBarIcon: ({ color, size }) => <Compass size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Near Me',
          tabBarIcon: ({ color, size }) => <Navigation size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="shabbat"
        options={{
          title: 'Shabbat',
          tabBarIcon: ({ color, size }) => <Flame size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
