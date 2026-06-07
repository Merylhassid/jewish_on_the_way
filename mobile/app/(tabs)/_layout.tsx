import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Compass, MapPin, Navigation, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/store/auth';
import { C } from '@/constants/theme';

export default function TabLayout() {
  const { token, loading } = useAuth();
  const { t } = useTranslation();

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
          fontFamily: 'Inter-SemiBold',
          letterSpacing: 0.3,
          marginTop: 3,
        },
        tabBarButton: (props) => {
          const { onPress, children, style, accessibilityState } = props as any;
          return (
            <View
              style={[style, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
              accessible
              accessibilityRole="button"
              accessibilityState={accessibilityState}
              onTouchEnd={() => {
                Haptics.selectionAsync().catch(() => {});
                onPress?.();
              }}
            >
              {children}
            </View>
          );
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color, size }) => <MapPin size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="compass"
        options={{
          title: t('tabs.compass'),
          tabBarIcon: ({ color, size }) => <Compass size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: t('tabs.nearby'),
          tabBarIcon: ({ color, size }) => <Navigation size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="shabbat"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User size={size ?? 22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
    </Tabs>
  );
}
