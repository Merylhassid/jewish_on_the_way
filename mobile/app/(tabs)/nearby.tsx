import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocation } from '@/src/hooks/useLocation';
import { ChevronRight, Flame, MapPin, Navigation, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import ErrorState from '@/src/components/ErrorState';
import { getPrayerConfig } from '@/src/utils/prayerIcons';
import SynagogueIcon, { SYNAGOGUE_ICON_BG } from '@/src/components/SynagogueIcon';

interface NearbyRestaurant {
  id: number;
  name: string;
  address?: string;
  kashrutLevel: string;
  restaurantType: string | null;
  distanceMeters: number;
  city?: string;
  verificationStatus?: string | null;
  googleRating?: number | string | null;
  googleRatingCount?: number | null;
  photoUrl?: string | null;
}
interface NearbySynagogue  { id: number; name: string; address?: string; denomination?: string; distanceMeters: number; }
interface NearbyMinyan     { id: number; prayerType: string; date: string; time: string; locationText: string; participantsCount: number; almostFull: boolean; isFull: boolean; distanceMeters: number; destination: { id: number; city: string } | null; }

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
const KASHRUT: Record<string, { label: string; color: string; bg: string }> = {
  rabbinate: { label: 'רבנות', color: C.kashrutNeutral, bg: C.kashrutNeutralBg },
  mehadrin:  { label: 'מהדרין', color: C.kashrutGold,    bg: C.kashrutGoldBg },
  badatz:    { label: 'בד"ץ',  color: C.kashrutGold,    bg: C.kashrutGoldBg },
  unknown:   { label: 'כשר',   color: '#9CA3AF',        bg: '#F9FAFB' },
};

function fmtDate(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const fmt = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

export default function NearbyScreen() {
  const { t } = useTranslation();
  const PRAYER_LABEL: Record<string, string> = {
    shacharit: t('minyans.shacharit'), mincha: t('minyans.mincha'),
    maariv: t('minyans.maariv'), musaf: t('minyans.musaf'), other: t('minyans.other'),
  };
  const { status: locStatus, coords, openSettings } = useLocation(true);
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [synagogues,  setSynagogues]  = useState<NearbySynagogue[]>([]);
  const [minyans,     setMinyans]     = useState<NearbyMinyan[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(false);
  const [retryKey,    setRetryKey]    = useState(0);

  useEffect(() => {
    if (!coords) return;
    setError(false);
    if (!refreshing) setLoading(true);
    const { lat, lng } = coords;
    (async () => {
      try {
        const [r, s, mn] = await Promise.allSettled([
          client.get('/restaurants/nearby', { params: { lat, lng, limit: 8 } }),
          client.get('/synagogues/nearby',  { params: { lat, lng, limit: 5 } }),
          client.get('/minyans/nearby',     { params: { lat, lng, radius: 5 } }),
        ]);
        if (r.status === 'fulfilled') setRestaurants(r.value.data);
        if (s.status === 'fulfilled') setSynagogues(s.value.data);
        if (mn.status === 'fulfilled') setMinyans(mn.value.data);
        if (r.status === 'rejected' && s.status === 'rejected' && mn.status === 'rejected') setError(true);
      } catch { setError(true); } finally { setLoading(false); setRefreshing(false); }
    })();
  }, [coords, retryKey]);

  if (locStatus === 'requesting' || (locStatus === 'idle' && loading)) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={s.centreText}>{t('nearby.finding')}</Text>
    </View>
  );

  if (!loading && error) return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>NEAR ME</Text>
          <Text style={s.title}>Nearby</Text>
        </View>
      </View>
      <ErrorState onRetry={() => setRetryKey(k => k + 1)} />
    </View>
  );

  if (locStatus === 'denied') return (
    <View style={s.center}>
      <Navigation size={48} color="#E5E7EB" strokeWidth={1.5} />
      <Text style={s.centreText}>{t('nearby.permRequired')}</Text>
      <Text style={s.centreSub}>{t('nearby.permSub')}</Text>
      <Pressable style={s.settingsBtn} onPress={openSettings}>
        <Text style={s.settingsBtnText}>{t('nearby.openSettings')}</Text>
      </Pressable>
    </View>
  );

  const total = restaurants.length + synagogues.length + minyans.length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>{t('nearby.eyebrow')}</Text>
          <Text style={s.title}>{t('nearby.title')}</Text>
        </View>
        <View style={s.gpsPill}>
          <MapPin size={12} color={C.gold} strokeWidth={2.5} />
          <Text style={s.gpsPillText}>{t('nearby.gpsActive')}</Text>
        </View>
      </View>

      {total === 0 ? (
        <View style={s.center}>
          <Navigation size={44} color="#E5E7EB" strokeWidth={1.5} />
          <Text style={s.centreText}>{t('nearby.noPlaces')}</Text>
          <Text style={s.centreSub}>{t('nearby.noPlacesSub')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setRetryKey(k => k + 1); }}
              tintColor={C.gold}
            />
          }
        >

          {restaurants.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('nearby.restaurants')}  ·  {restaurants.length}</Text>
              <View style={s.cards}>
                {restaurants.map(r => {
                  const k = KASHRUT[r.kashrutLevel] ?? KASHRUT.unknown;
                  const typeColor = TYPE_COLOR[r.restaurantType ?? 'unknown'] ?? TYPE_COLOR.unknown;
                  const typeLabel = TYPE_LABEL[r.restaurantType ?? 'unknown'] ?? TYPE_LABEL.unknown;
                  const typeBg = TYPE_BG[r.restaurantType ?? 'unknown'] ?? TYPE_BG.unknown;
                  const isVerified = r.verificationStatus === 'verified';
                  const rating = r.googleRating != null ? Number(r.googleRating) : null;
                  const hasGoogleRating = isVerified && rating != null && Number.isFinite(rating);
                  return (
                    <Pressable
                      key={r.id}
                      style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
                      onPress={() => router.push(`/restaurant/${r.id}` as any)}
                    >
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
                        </View>
                        {(r.address || r.city) && (
                          <View style={s.cardMeta}>
                            <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
                            <Text style={s.metaText} numberOfLines={1}>{r.address || r.city}</Text>
                          </View>
                        )}
                        <View style={s.cardBottom}>
                          <View style={s.distPill}>
                            <Navigation size={10} color={C.gold} strokeWidth={2.5} />
                            <Text style={s.distText}>{fmt(r.distanceMeters)}</Text>
                          </View>
                          <View style={{ flex: 1 }} />
                          <ChevronRight size={16} color="#E5E7EB" strokeWidth={2.5} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {synagogues.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('nearby.synagogues')}  ·  {synagogues.length}</Text>
              <View style={s.cards}>
                {synagogues.map(sg => (
                  <Pressable
                    key={sg.id}
                    style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
                    onPress={() => router.push(`/synagogue/${sg.id}` as any)}
                  >
                    <View style={[s.cardIcon, { backgroundColor: SYNAGOGUE_ICON_BG }]}>
                      <SynagogueIcon size={20} />
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

          {minyans.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('nearby.minyans')}  ·  {minyans.length}</Text>
              <View style={s.cards}>
                {minyans.map(mn => (
                  <Pressable
                    key={mn.id}
                    style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
                    onPress={() => router.push(`/minyan/${mn.id}` as any)}
                  >
                    {(() => {
                      const cfg = getPrayerConfig(mn.prayerType);
                      return (
                        <View style={[s.cardIcon, { backgroundColor: cfg.bg }]}>
                          <cfg.Icon size={20} color={cfg.color} strokeWidth={2} />
                        </View>
                      );
                    })()}
                    <View style={s.cardBody}>
                      <Text style={s.cardName} numberOfLines={1}>{PRAYER_LABEL[mn.prayerType] ?? mn.prayerType}</Text>
                      <Text style={s.cardSub} numberOfLines={1}>{fmtDate(mn.date)} · {mn.time}{mn.destination ? `  ·  ${mn.destination.city}` : ''}</Text>
                    </View>
                    <View style={s.cardRight}>
                      {mn.isFull && (
                        <View style={[s.badge, s.badgeFull]}>
                          <Text style={[s.badgeText, s.badgeTextFull]}>{t('minyans.full')}</Text>
                        </View>
                      )}
                      {mn.almostFull && !mn.isFull && (
                        <View style={[s.badge, s.badgeAlmost, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                          <Flame size={10} color={C.kashrutGold} strokeWidth={2} />
                        </View>
                      )}
                      <View style={s.distPill}>
                        <Navigation size={10} color={C.gold} strokeWidth={2.5} />
                        <Text style={s.distText}>{fmt(mn.distanceMeters)}</Text>
                      </View>
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
    flexDirection: 'row',
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    shadowColor: C.cardShadow, shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
    borderWidth: 1,
    borderColor: '#F3EFE7',
  },
  cardIcon:  { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardBody:  { flex: 1, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  thumbnail: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEF2F6' },
  cardName:  { fontFamily: 'Inter-Bold', fontSize: 16, color: C.navy, letterSpacing: -0.1 },
  cardSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 2 },
  typeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  cardType: { fontFamily: 'Inter-SemiBold', fontSize: 12, marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  ratingStar: { fontFamily: 'Inter-Bold', fontSize: 12.5, color: C.gold },
  ratingScore: { fontFamily: 'Inter-Bold', fontSize: 12.5, color: C.navy },
  ratingCount: { fontSize: 12, color: C.textMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  badge:     { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontFamily: 'Inter-Bold', fontSize: 10 },
  badgeFull: { backgroundColor: C.typeParveBg },
  badgeAlmost: { backgroundColor: C.kashrutGoldBg },
  badgeTextFull: { color: C.typeParve },
  distPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldFaint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  distText:  { fontFamily: 'Inter-Bold', fontSize: 11, color: C.gold },
});
