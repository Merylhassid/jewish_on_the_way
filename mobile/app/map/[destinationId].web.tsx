import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

export default function MapScreenWeb() {
  const { destinationId, name } = useLocalSearchParams<{ destinationId: string; name?: string }>();
  const cityName = name ? decodeURIComponent(name) : 'Map';
  const [counts, setCounts] = useState({ r: 0, s: 0 });

  useEffect(() => {
    (async () => {
      const [rRes, sRes] = await Promise.allSettled([
        client.get('/restaurants', { params: { destinationId } }),
        client.get('/synagogues',  { params: { destinationId } }),
      ]);
      const r = rRes.status === 'fulfilled' ? (Array.isArray(rRes.value.data) ? rRes.value.data : rRes.value.data?.data ?? []).length : 0;
      const s = sRes.status === 'fulfilled' ? (Array.isArray(sRes.value.data) ? sRes.value.data : sRes.value.data?.data ?? []).length : 0;
      setCounts({ r, s });
    })();
  }, [destinationId]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{cityName}</Text>
      </View>

      <View style={s.body}>
        <Text style={s.icon}>🗺️</Text>
        <Text style={s.title}>Map is available in the mobile app</Text>
        <Text style={s.sub}>
          {counts.r} restaurants · {counts.s} synagogues in {cityName}
        </Text>
        <Pressable
          style={s.btn}
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(cityName + ' kosher')}`)}
        >
          <Text style={s.btnText}>Open in Google Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16, paddingHorizontal: 18,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 18, color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  icon:  { fontSize: 56 },
  title: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.textPrimary, textAlign: 'center' },
  sub:   { fontFamily: 'Inter-Regular',  fontSize: 14, color: C.textMuted,    textAlign: 'center', marginBottom: 8 },
  btn: {
    backgroundColor: C.navy, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  btnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
});
