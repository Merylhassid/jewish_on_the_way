import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocation } from '@/src/hooks/useLocation';
import { ChevronRight, Globe, MapPin, Navigation, Utensils } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface NearbyRestaurant { id: number; name: string; address?: string; kashrutLevel: string; restaurantType: string | null; distanceMeters: number; city?: string; }
interface NearbySynagogue  { id: number; name: string; address?: string; denomination?: string; distanceMeters: number; }

const KASHRUT: Record<string, { color: string; bg: string }> = {
  rabbinate: { color: '#6B7280', bg: '#F3F4F6' },
  mehadrin:  { color: '#2563EB', bg: '#EFF6FF' },
  badatz:    { color: '#16A34A', bg: '#F0FDF4' },
  unknown:   { color: '#9CA3AF', bg: '#F9FAFB' },
};

const fmt = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

export default function NearbyScreen() {
  const { status: locStatus, coords, openSettings } = useLocation(true);
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [synagogues,  setSynagogues]  = useState<NearbySynagogue[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!coords) return;
    const { lat, lng } = coords;
    (async () => {
      try {
        const [r, s] = await Promise.allSettled([
          client.get('/restaurants/nearby', { params: { lat, lng, limit: 8 } }),
          client.get('/synagogues/nearby',  { params: { lat, lng, limit: 5 } }),
        ]);
        if (r.status === 'fulfilled') setRestaurants(r.value.data);
        if (s.status === 'fulfilled') setSynagogues(s.value.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [coords]);

  if (locStatus === 'requesting' || (locStatus === 'idle' && loading)) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={s.centreText}>Finding places near you…</Text>
    </View>
  );

  if (locStatus === 'denied') return (
    <View style={s.center}>
      <Navigation size={48} color="#E5E7EB" strokeWidth={1.5} />
      <Text style={s.centreText}>Location permission required</Text>
      <Text style={s.centreSub}>Enable location to find nearby places</Text>
      <Pressable style={s.settingsBtn} onPress={openSettings}>
        <Text style={s.settingsBtnText}>Open Settings</Text>
      </Pressable>
    </View>
  );

  const total = restaurants.length + synagogues.length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>NEAR ME</Text>
          <Text style={s.title}>Nearby</Text>
        </View>
        <View style={s.gpsPill}>
          <MapPin size={12} color={C.gold} strokeWidth={2.5} />
          <Text style={s.gpsPillText}>GPS active</Text>
        </View>
      </View>

      {total === 0 ? (
        <View style={s.center}>
          <Navigation size={44} color="#E5E7EB" strokeWidth={1.5} />
          <Text style={s.centreText}>No places nearby</Text>
          <Text style={s.centreSub}>Try exploring destinations instead</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

          {restaurants.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>KOSHER RESTAURANTS  ·  {restaurants.length}</Text>
              <View style={s.cards}>
                {restaurants.map(r => {
                  const k = KASHRUT[r.kashrutLevel] ?? KASHRUT.unknown;
                  return (
                    <Pressable
                      key={r.id}
                      style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
                      onPress={() => router.push(`/restaurant/${r.id}` as any)}
                    >
                      <View style={[s.cardIcon, { backgroundColor: '#FEF9EC' }]}>
                        <Utensils size={18} color={C.gold} strokeWidth={2} />
                      </View>
                      <View style={s.cardBody}>
                        <Text style={s.cardName} numberOfLines={1}>{r.name}</Text>
                        {r.city && <Text style={s.cardSub}>{r.city}</Text>}
                      </View>
                      <View style={s.cardRight}>
                        <View style={[s.badge, { backgroundColor: k.bg }]}>
                          <Text style={[s.badgeText, { color: k.color }]}>{r.kashrutLevel}</Text>
                        </View>
                        <View style={s.distPill}>
                          <Navigation size={10} color={C.gold} strokeWidth={2.5} />
                          <Text style={s.distText}>{fmt(r.distanceMeters)}</Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color="#E5E7EB" strokeWidth={2.5} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {synagogues.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>SYNAGOGUES  ·  {synagogues.length}</Text>
              <View style={s.cards}>
                {synagogues.map(sg => (
                  <Pressable
                    key={sg.id}
                    style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
                    onPress={() => router.push(`/synagogue/${sg.id}` as any)}
                  >
                    <View style={[s.cardIcon, { backgroundColor: '#F5F3FF' }]}>
                      <Globe size={18} color="#7C3AED" strokeWidth={2} />
                    </View>
                    <View style={s.cardBody}>
                      <Text style={s.cardName} numberOfLines={1}>{sg.name}</Text>
                      {sg.address && <Text style={s.cardSub} numberOfLines={1}>{sg.address}</Text>}
                    </View>
                    <View style={s.distPill}>
                      <Navigation size={10} color={C.gold} strokeWidth={2.5} />
                      <Text style={s.distText}>{fmt(sg.distanceMeters)}</Text>
                    </View>
                    <ChevronRight size={16} color="#E5E7EB" strokeWidth={2.5} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  centreText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
  centreSub:  { fontFamily: 'Inter-Regular',  fontSize: 13, color: C.textMuted },
  settingsBtn: {
    marginTop: 8, backgroundColor: C.navy, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  settingsBtnText: { fontFamily: 'Inter-SemiBold', color: '#fff', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  eyebrow: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 3 },
  title:   { fontFamily: 'Inter-Black', fontSize: 30, color: C.textPrimary, letterSpacing: -0.8 },
  gpsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.goldFaint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.goldBorder,
  },
  gpsPillText: { fontFamily: 'Inter-Bold', fontSize: 11, color: C.gold },

  body:    { paddingHorizontal: 20, paddingTop: 24, gap: 28, paddingBottom: 40 },
  section: { gap: 12 },
  sectionLabel: { fontFamily: 'Inter-Bold', fontSize: 11, color: '#BBC3D4', letterSpacing: 2 },
  cards:   { gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardIcon:  { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardBody:  { flex: 1 },
  cardName:  { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.textPrimary },
  cardSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  badge:     { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontFamily: 'Inter-Bold', fontSize: 10, textTransform: 'capitalize' },
  distPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldFaint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  distText:  { fontFamily: 'Inter-Bold', fontSize: 11, color: C.gold },
});
