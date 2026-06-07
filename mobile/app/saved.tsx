import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Bookmark, Globe, Utensils, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

const STORAGE_KEY = 'user_favorites_local';

async function loadLocalFavIds(): Promise<{ restaurants: number[]; synagogues: number[] }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const favs: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    return {
      restaurants: Object.keys(favs).filter(k => k.startsWith('restaurant:') && favs[k]).map(k => parseInt(k.split(':')[1])),
      synagogues:  Object.keys(favs).filter(k => k.startsWith('synagogue:') && favs[k]).map(k => parseInt(k.split(':')[1])),
    };
  } catch { return { restaurants: [], synagogues: [] }; }
}

async function removeLocalFav(type: string, id: number) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const favs: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    delete favs[`${type}:${id}`];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  } catch {}
}

interface SavedRestaurant { id: number; name: string; address?: string; kashrutLevel: string; restaurantType: string | null; destination: { id: number; city: string } | null; }
interface SavedSynagogue  { id: number; name: string; address?: string; denomination?: string; }

const KASHRUT_COLOR: Record<string, { color: string; bg: string }> = {
  rabbinate: { color: '#6B7280', bg: '#F3F4F6' },
  mehadrin:  { color: '#2563EB', bg: '#EFF6FF' },
  badatz:    { color: '#16A34A', bg: '#F0FDF4' },
  unknown:   { color: '#9CA3AF', bg: '#F9FAFB' },
};

export default function SavedScreen() {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<SavedRestaurant[]>([]);
  const [synagogues, setSynagogues]   = useState<SavedSynagogue[]>([]);
  const [loading, setLoading]         = useState(true);

  const removeR = (id: number) => { setRestaurants(p => p.filter(r => r.id !== id)); removeLocalFav('restaurant', id); client.post(`/favorites/restaurant/${id}`).catch(() => {}); };
  const removeS = (id: number) => { setSynagogues(p => p.filter(s => s.id !== id));  removeLocalFav('synagogue', id);  client.post(`/favorites/synagogue/${id}`).catch(() => {}); };

  useEffect(() => {
    client.get('/favorites')
      .then(r => { setRestaurants(r.data.restaurants ?? []); setSynagogues(r.data.synagogues ?? []); })
      .catch(async () => {
        const { restaurants: rIds, synagogues: sIds } = await loadLocalFavIds();
        const [rRes, sRes] = await Promise.allSettled([
          rIds.length ? Promise.all(rIds.map(id => client.get(`/restaurants/${id}`).then(r => r.data))) : Promise.resolve([]),
          sIds.length ? Promise.all(sIds.map(id => client.get(`/synagogues/${id}`).then(r => r.data)))  : Promise.resolve([]),
        ]);
        setRestaurants(rRes.status === 'fulfilled' ? rRes.value : []);
        setSynagogues(sRes.status === 'fulfilled'  ? sRes.value  : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const total = restaurants.length + synagogues.length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('saved.title')}</Text>
          {!loading && <Text style={s.headerSub}>{total} {total !== 1 ? t('saved.savedCountPlural') : t('saved.savedCount')}</Text>}
        </View>
        <View style={s.headerIcon}>
          <Bookmark size={18} color={C.gold} strokeWidth={2} fill={C.gold} />
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : total === 0 ? (
        <View style={s.center}>
          <Bookmark size={48} color="#E5E7EB" strokeWidth={1.5} />
          <Text style={s.emptyTitle}>{t('saved.empty')}</Text>
          <Text style={s.emptySub}>{t('saved.emptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

          {restaurants.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('saved.restaurants')}  ·  {restaurants.length}</Text>
              <View style={s.cards}>
                {restaurants.map(r => {
                  const k = KASHRUT_COLOR[r.kashrutLevel] ?? KASHRUT_COLOR.unknown;
                  return (
                    <Pressable key={r.id} style={s.card} onPress={() => router.push(`/restaurant/${r.id}` as any)}>
                      <View style={[s.cardIcon, { backgroundColor: '#FEF9EC' }]}>
                        <Utensils size={18} color={C.gold} strokeWidth={2} />
                      </View>
                      <View style={s.cardBody}>
                        <Text style={s.cardName} numberOfLines={1}>{r.name}</Text>
                        <Text style={s.cardSub}>{r.destination?.city || r.address || '—'}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: k.bg }]}>
                        <Text style={[s.badgeText, { color: k.color }]}>{r.kashrutLevel}</Text>
                      </View>
                      <Pressable style={s.del} onPress={() => removeR(r.id)} hitSlop={10}>
                        <X size={15} color="#D1D5DB" strokeWidth={2.5} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {synagogues.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('saved.synagogues')}  ·  {synagogues.length}</Text>
              <View style={s.cards}>
                {synagogues.map(sg => (
                  <Pressable key={sg.id} style={s.card} onPress={() => router.push(`/synagogue/${sg.id}` as any)}>
                    <View style={[s.cardIcon, { backgroundColor: '#F5F3FF' }]}>
                      <Globe size={18} color="#7C3AED" strokeWidth={2} />
                    </View>
                    <View style={s.cardBody}>
                      <Text style={s.cardName} numberOfLines={1}>{sg.name}</Text>
                      {sg.address && <Text style={s.cardSub} numberOfLines={1}>{sg.address}</Text>}
                    </View>
                    <Pressable style={s.del} onPress={() => removeS(sg.id)} hitSlop={10}>
                      <X size={15} color="#D1D5DB" strokeWidth={2.5} />
                    </Pressable>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingBottom: 18, paddingHorizontal: 20,
  },
  back: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 20, color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(255,255,255,0.50)', marginTop: 2 },
  headerIcon:  { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },

  emptyTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: C.textSecondary },
  emptySub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' },

  body:    { paddingHorizontal: 20, paddingTop: 24, gap: 28 },
  section: { gap: 12 },
  sectionLabel: { fontFamily: 'Inter-Bold', fontSize: 11, color: '#BBC3D4', letterSpacing: 2 },
  cards:   { gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardName: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.textPrimary },
  cardSub:  { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 2 },
  badge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:{ fontFamily: 'Inter-Bold', fontSize: 10, textTransform: 'capitalize' },
  del:      { padding: 4 },
});
