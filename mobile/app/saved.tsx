import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Bookmark, MapPin, Utensils, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import SynagogueIcon, { SYNAGOGUE_ICON_BG } from '@/src/components/SynagogueIcon';
import { useAuth } from '@/src/store/auth';

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

interface SavedRestaurant {
  id: number;
  name: string;
  address?: string;
  kashrutLevel: string;
  restaurantType: string | null;
  destination: { id: number; city: string } | null;
  verificationStatus?: string | null;
  googleRating?: number | string | null;
  googleRatingCount?: number | null;
  photoUrl?: string | null;
}
interface SavedSynagogue  { id: number; name: string; address?: string; denomination?: string; }

const TYPE_COLOR: Record<string, string> = {
  meat: C.typeMeat,
  dairy: C.typeDairy,
  parve: C.typeParve,
  pareve: C.typeParve,
  unknown: '#9CA3AF',
};
const TYPE_BG: Record<string, string> = {
  meat: C.typeMeatBg,
  dairy: C.typeDairyBg,
  parve: C.typeParveBg,
  pareve: C.typeParveBg,
  unknown: '#F4F4F5',
};
const TYPE_LABEL: Record<string, string> = {
  meat: 'בשרי',
  dairy: 'חלבי',
  parve: 'פרווה',
  pareve: 'פרווה',
  unknown: 'כשר',
};
const KASHRUT_COLOR: Record<string, { label: string; color: string; bg: string }> = {
  rabbinate: { label: 'רבנות', color: C.kashrutNeutral, bg: C.kashrutNeutralBg },
  mehadrin:  { label: 'מהדרין', color: C.kashrutGold,    bg: C.kashrutGoldBg },
  badatz:    { label: 'בד"ץ',  color: C.kashrutGold,    bg: C.kashrutGoldBg },
  unknown:   { label: 'כשר',   color: '#9CA3AF',        bg: '#F9FAFB' },
};

export default function SavedScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [restaurants, setRestaurants] = useState<SavedRestaurant[]>([]);
  const [synagogues, setSynagogues]   = useState<SavedSynagogue[]>([]);
  const [loading, setLoading]         = useState(true);

  const removeR = (id: number) => {
    setRestaurants(p => p.filter(r => r.id !== id));
    removeLocalFav('restaurant', id);
    if (isAuthenticated) {
      client.get(`/favorites/restaurant/${id}`)
        .then(response => response.data.saved ? client.post(`/favorites/restaurant/${id}`) : undefined)
        .catch(() => {});
    }
  };
  const removeS = (id: number) => {
    setSynagogues(p => p.filter(s => s.id !== id));
    removeLocalFav('synagogue', id);
    if (isAuthenticated) {
      client.get(`/favorites/synagogue/${id}`)
        .then(response => response.data.saved ? client.post(`/favorites/synagogue/${id}`) : undefined)
        .catch(() => {});
    }
  };

  useEffect(() => {
    const loadPublicLocalFavorites = async (rIds: number[], sIds: number[]) => {
        const [rRes, sRes] = await Promise.allSettled([
          rIds.length ? Promise.all(rIds.map(id => client.get(`/restaurants/${id}`).then(r => r.data))) : Promise.resolve([]),
          sIds.length ? Promise.all(sIds.map(id => client.get(`/synagogues/${id}`).then(r => r.data)))  : Promise.resolve([]),
        ]);
        setRestaurants(rRes.status === 'fulfilled' ? rRes.value : []);
        setSynagogues(sRes.status === 'fulfilled'  ? sRes.value  : []);
    };

    (async () => {
      const local = await loadLocalFavIds();
      if (!isAuthenticated) {
        await loadPublicLocalFavorites(local.restaurants, local.synagogues);
        return;
      }

      try {
        const server = await client.get('/favorites');
        const serverRestaurants: SavedRestaurant[] = server.data.restaurants ?? [];
        const serverSynagogues: SavedSynagogue[] = server.data.synagogues ?? [];
        const serverRestaurantIds = new Set(serverRestaurants.map(item => item.id));
        const serverSynagogueIds = new Set(serverSynagogues.map(item => item.id));
        const missing = [
          ...local.restaurants.filter(id => !serverRestaurantIds.has(id)).map(id => client.post(`/favorites/restaurant/${id}`)),
          ...local.synagogues.filter(id => !serverSynagogueIds.has(id)).map(id => client.post(`/favorites/synagogue/${id}`)),
        ];
        if (missing.length) await Promise.allSettled(missing);
        const merged = missing.length ? await client.get('/favorites') : server;
        setRestaurants(merged.data.restaurants ?? []);
        setSynagogues(merged.data.synagogues ?? []);
      } catch {
        await loadPublicLocalFavorites(local.restaurants, local.synagogues);
      }
    })().finally(() => setLoading(false));
  }, [isAuthenticated]);

  const total = restaurants.length + synagogues.length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color={C.navy} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>{t('saved.title')}</Text>
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
                  const typeColor = TYPE_COLOR[r.restaurantType ?? 'unknown'] ?? TYPE_COLOR.unknown;
                  const typeLabel = TYPE_LABEL[r.restaurantType ?? 'unknown'] ?? TYPE_LABEL.unknown;
                  const typeBg = TYPE_BG[r.restaurantType ?? 'unknown'] ?? TYPE_BG.unknown;
                  const isVerified = r.verificationStatus === 'verified';
                  const rating = r.googleRating != null ? Number(r.googleRating) : null;
                  const hasGoogleRating = isVerified && rating != null && Number.isFinite(rating);
                  return (
                    <Pressable key={r.id} style={s.card} onPress={() => router.push(`/restaurant/${r.id}` as any)}>
                      <View style={s.cardBody}>
                        <View style={s.cardTop}>
                          {r.photoUrl ? (
                            <Image source={{ uri: r.photoUrl }} style={s.thumbnail} contentFit="cover" transition={180} />
                          ) : (
                            <View style={[s.typeIcon, { backgroundColor: typeBg }]}>
                              <Utensils size={16} color={typeColor} strokeWidth={2} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={s.cardName} numberOfLines={1}>{r.name}</Text>
                            <View style={s.typeLabelRow}>
                              <View style={[s.typeDot, { backgroundColor: typeColor }]} />
                              <Text style={[s.cardType, { color: typeColor }]}>{typeLabel}</Text>
                            </View>
                            {hasGoogleRating && (
                              <View style={s.ratingRow}>
                                <Text style={s.ratingStar}>★</Text>
                                <Text style={s.ratingScore}>{rating!.toFixed(1)}</Text>
                                <Text style={s.ratingCount}>
                                  {r.googleRatingCount ? `(${r.googleRatingCount} · Google)` : '(Google)'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={[s.badge, { backgroundColor: k.bg }]}>
                            <Text style={[s.badgeText, { color: k.color }]}>{k.label}</Text>
                          </View>
                          <Pressable
                            style={s.del}
                            onPress={(event) => {
                              event.stopPropagation();
                              removeR(r.id);
                            }}
                            hitSlop={10}
                          >
                            <X size={15} color="#D1D5DB" strokeWidth={2.5} />
                          </Pressable>
                        </View>

                        {(r.address || r.destination?.city) && (
                          <View style={s.cardMeta}>
                            <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
                            <Text style={s.metaText} numberOfLines={1}>{r.address || r.destination?.city}</Text>
                          </View>
                        )}
                      </View>
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
                    <View style={[s.cardIcon, { backgroundColor: SYNAGOGUE_ICON_BG }]}>
                      <SynagogueIcon size={20} />
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
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingBottom: 18, paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  back: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerEyebrow: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldEyebrow, letterSpacing: 2.5, marginBottom: 4 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 28, color: C.navy, letterSpacing: -0.6 },
  headerSub:   { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, marginTop: 3 },
  headerIcon:  { width: 38, height: 38, borderRadius: 19, backgroundColor: C.goldFaint, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.goldBorder },

  emptyTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: C.textSecondary },
  emptySub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' },

  body:    { paddingHorizontal: 20, paddingTop: 24, gap: 28 },
  section: { gap: 12 },
  sectionLabel: { fontFamily: 'Inter-Bold', fontSize: 11, color: '#BBC3D4', letterSpacing: 2 },
  cards:   { gap: 10 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    shadowColor: C.cardShadow, shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
    borderWidth: 1,
    borderColor: '#F3EFE7',
  },
  cardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  thumbnail: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEF2F6' },
  cardName: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.navy, letterSpacing: -0.1 },
  cardSub:  { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 2 },
  typeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  cardType: { fontFamily: 'Inter-SemiBold', fontSize: 12, marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  ratingStar: { fontFamily: 'Inter-Bold', fontSize: 12.5, color: C.gold },
  ratingScore: { fontFamily: 'Inter-Bold', fontSize: 12.5, color: C.navy },
  ratingCount: { fontSize: 12, color: C.textMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  badge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:{ fontFamily: 'Inter-Bold', fontSize: 10 },
  del:      { padding: 4 },
});
