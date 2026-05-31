import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/src/store/auth';
import { C } from '@/constants/theme';

export default function TabLayout() {
  const { token, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <View style={{ flex: 1, backgroundColor: '#F2F5FB' }} />;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#0C2461',
        tabBarInactiveTintColor: '#9AA8C0',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E1E8F5',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.destinations'),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size ?? 24} name="map.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="compass"
        options={{
          title: t('tabs.compass'),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size ?? 24} name="safari.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Near Me',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size ?? 24} name="location.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shabbat"
        options={{
          title: 'שבת',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size ?? 24} name="flame.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size ?? 24} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
