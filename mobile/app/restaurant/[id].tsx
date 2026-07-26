import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import ReviewSection from '@/src/components/ReviewSection';
import ReportModal from '@/src/components/ReportModal';
import FavoriteButton from '@/src/components/FavoriteButton';
import { useRequireAuth } from '@/src/auth/auth-gates';

interface Restaurant {
  id: number;
  name: string;
  restaurantType: string | null;
  kashrutLevel: string;
  address?: string;
  originalAddress?: string;
  phone?: string;
  originalPhone?: string;
  category?: string;
  about?: string;
  websiteUrl?: string;
  openingHours?: string;
  lat?: number;
  lng?: number;
  googleLat?: number;
  googleLng?: number;
  verificationStatus?: string;
  googleDisplayName?: string;
  googleDisplayNameHe?: string;
  googleRating?: number | string | null;
  googleRatingCount?: number | null;
  googlePhone?: string | null;
  googleMapsUri?: string | null;
  photoUrl?: string | null;
  photoAttribution?: string | null;
  photoSource?: string | null;
  createdAt: string;
  destination?: { id: number; city: string; country: string };
}

const TYPE_COLOR: Record<string, string> = {
  meat:    C.typeMeatBg,
  dairy:   C.typeDairyBg,
  pareve:  C.typeParveBg,
  parve:   C.typeParveBg,
  unknown: '#F4F4F5',
};
const TYPE_ICON: Record<string, React.ComponentProps<typeof MaterialIcons>['name']> = {
  meat:    'restaurant',
  dairy:   'local-cafe',
  pareve:  'eco',
  parve:   'eco',
  unknown: 'restaurant-menu',
};
const TYPE_TINT: Record<string, string> = {
  meat:    C.typeMeat,
  dairy:   C.typeDairy,
  pareve:  C.typeParve,
  parve:   C.typeParve,
  unknown: C.navy,
};

export default function RestaurantDetailScreen() {
  const { t } = useTranslation();
  const requireAuth = useRequireAuth();

  const TYPE_LABEL: Record<string, string> = {
    meat:    t('restaurants.meat'),
    dairy:   t('restaurants.dairy'),
    pareve:  t('restaurants.pareve'),
    parve:   t('restaurants.pareve'),
    unknown: t('restaurants.unknownType'),
  };

  const KASHRUT: Record<string, { label: string; color: string; bg: string; desc: string }> = {
    rabbinate: { label: t('restaurants.rabbinate'), color: C.kashrutNeutral, bg: C.kashrutNeutralBg, desc: t('restaurants.rabbinateDesc') },
    mehadrin:  { label: t('restaurants.mehadrin'),  color: C.kashrutGold,    bg: C.kashrutGoldBg,    desc: t('restaurants.mehadrinDesc') },
    badatz:    { label: t('restaurants.badatz'),    color: C.kashrutGold,    bg: C.kashrutGoldBg,    desc: t('restaurants.badatzDesc') },
    unknown:   { label: t('restaurants.kosher'),    color: C.kashrutNeutral, bg: '#F9FAFB',          desc: t('restaurants.kosherDesc') },
  };

  const formatDistance = (meters: number) =>
    meters < 1000
      ? `${Math.round(meters)} ${t('restaurants.distanceM')}`
      : `${(meters / 1000).toFixed(1)} ${t('restaurants.distanceKm')}`;

  const {
    id, distance,
    name: nameParam, restaurantType: typeParam,
    kashrutLevel: kashrutParam, address: addressParam,
    openingHours: hoursParam,
  } = useLocalSearchParams<{
    id: string; distance?: string;
    name?: string; restaurantType?: string;
    kashrutLevel?: string; address?: string; openingHours?: string;
  }>();
  const distanceMeters = distance ? parseInt(distance, 10) : undefined;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    client
      .get(`/restaurants/${id}`)
      .then((res) => setRestaurant(res.data))
      .catch(() => {
        // API failed — use data passed from list screen as fallback
        if (nameParam) {
          setRestaurant({
            id: Number(id),
            name: nameParam,
            restaurantType: typeParam || null,
            kashrutLevel: kashrutParam || 'unknown',
            address: addressParam || undefined,
            openingHours: hoursParam || undefined,
            createdAt: '',
          });
        } else {
          setError(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const openCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const openWebsite = (websiteUrl: string) => {
    Linking.openURL(websiteUrl).catch(() => {});
  };

  const openMap = (lat: number, lng: number, name: string) => {
    const label = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${label}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() => {
      // Fall back to Google Maps web
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
  };

  const openMapByAddress = (address: string) => {
    const q = encodeURIComponent(address);
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
  };

  const openGoogleMaps = () => {
    if (restaurant?.googleMapsUri) {
      Linking.openURL(restaurant.googleMapsUri).catch(() => {});
      return;
    }
    if (restaurant?.lat != null && restaurant?.lng != null) {
      openMap(restaurant.lat, restaurant.lng, restaurant.name);
    } else if (restaurant?.address) {
      openMapByAddress(restaurant.address);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (error || !restaurant) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{t('restaurants.notFound')}</Text>
        <Pressable onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backLinkText}>{t('restaurants.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const type      = restaurant.restaurantType ?? 'unknown';
  const kashrut   = KASHRUT[restaurant.kashrutLevel] ?? KASHRUT.unknown;
  const typeTint  = TYPE_TINT[type]  ?? C.navy;
  const typeBg    = TYPE_COLOR[type] ?? TYPE_COLOR.unknown;
  const typeLabel = TYPE_LABEL[type] ?? t('restaurants.unknownType');
  const typeIcon  = TYPE_ICON[type]  ?? 'restaurant-menu';

  const hasLocation = restaurant.lat != null && restaurant.lng != null;
  const hasPhone    = !!restaurant.phone;
  const hasAddress  = !!restaurant.address;
  const isVerified = restaurant.verificationStatus === 'verified';
  const rating = restaurant.googleRating != null ? Number(restaurant.googleRating) : null;
  const hasGoogleRating = isVerified && rating != null && Number.isFinite(rating);
  const normalizeName = (value?: string | null) =>
    (value ?? '').toLowerCase().replace(/[׳']/g, '').replace(/[״"]/g, '').replace(/\s+/g, ' ').trim();
  const googleName = restaurant.googleDisplayNameHe || restaurant.googleDisplayName;
  const normalizedName = normalizeName(restaurant.name);
  const normalizedGoogleName = normalizeName(googleName);
  const showGoogleName = isVerified && !!googleName && normalizedGoogleName !== normalizedName
    && !normalizedGoogleName.includes(normalizedName)
    && !normalizedName.includes(normalizedGoogleName);

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: typeBg }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <View style={s.backCircle}>
            <MaterialIcons name="arrow-back" size={20} color={C.navy} />
          </View>
        </Pressable>

        <View style={[s.headerIconRing, { backgroundColor: typeTint }]}>
          <MaterialIcons name={typeIcon} size={32} color="#fff" />
        </View>

        <View style={s.headerContent}>
          <View style={s.titleRow}>
            <Text style={s.headerName} numberOfLines={2}>{restaurant.name}</Text>
            <FavoriteButton entityType="restaurant" entityId={restaurant.id} size={26} color={C.gold} />
          </View>

          {restaurant.destination && (
            <Text style={s.headerSub}>
              {restaurant.destination.city}, {restaurant.destination.country}
            </Text>
          )}

          {showGoogleName && (
            <Text style={s.googleName} numberOfLines={1}>
              {t('restaurants.googleNamePrefix')}: {googleName}
            </Text>
          )}

          <View style={s.headerPills}>
            {hasGoogleRating && (
              <Pressable style={s.ratingPill} onPress={openGoogleMaps}>
                <Text style={s.ratingPillText}>
                  ★ {rating!.toFixed(1)} · {t('restaurants.googleSource')}
                  {restaurant.googleRatingCount ? ` (${restaurant.googleRatingCount} ${t('restaurants.reviews')})` : ''}
                </Text>
              </Pressable>
            )}
            {distanceMeters !== undefined && (
              <View style={s.distancePill}>
                <MaterialIcons name="place" size={12} color={C.goldMuted} />
                <Text style={s.distanceText}>{formatDistance(distanceMeters)}</Text>
              </View>
            )}
          </View>

        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {restaurant.photoUrl && (
          <View style={s.photoCard}>
            <Image source={{ uri: restaurant.photoUrl }} style={s.heroPhoto} contentFit="cover" transition={220} />
            <View style={s.photoBadge}>
              <Text style={s.photoBadgeText}>Google</Text>
            </View>
          </View>
        )}

        {/* ── Type + Kashrut ── */}
        <View style={[s.typeCard, { backgroundColor: typeBg }]}>
          <View style={s.badgeRow}>
            <View style={[s.chip, { borderColor: typeTint }]}>
              <MaterialIcons name={typeIcon} size={14} color={typeTint} />
              <Text style={[s.chipText, { color: typeTint }]}>{typeLabel}</Text>
            </View>
            <View style={[s.chip, { borderColor: kashrut.bg, backgroundColor: kashrut.bg }]}>
              <Text style={[s.chipText, { color: kashrut.color }]}>{kashrut.label}</Text>
            </View>
            {restaurant.category && (
              <View style={[s.chip, { borderColor: C.gold }]}>
                <Text style={[s.chipText, { color: C.gold }]}>{restaurant.category}</Text>
              </View>
            )}
          </View>
          <Text style={s.kashrutDesc}>{kashrut.desc}</Text>
        </View>

        {/* ── Info rows ── */}
        {hasAddress && (
          <View style={s.infoCard}>
            <MaterialIcons name="location-on" size={18} color={C.gold} style={s.infoIcon} />
            <View style={s.infoText}>
              <Text style={s.infoLabel}>{t('restaurants.address')}</Text>
              <Text style={s.infoValue}>{restaurant.address}</Text>
            </View>
          </View>
        )}

        {restaurant.openingHours && (
          <View style={s.infoCard}>
            <MaterialIcons name="schedule" size={18} color={C.gold} style={s.infoIcon} />
            <View style={s.infoText}>
              <Text style={s.infoLabel}>{t('restaurants.hours')}</Text>
              <Text style={s.infoValue}>{restaurant.openingHours}</Text>
            </View>
          </View>
        )}

        {restaurant.about && (
          <View style={s.infoCard}>
            <MaterialIcons name="info-outline" size={18} color={C.gold} style={s.infoIcon} />
            <View style={s.infoText}>
              <Text style={s.infoLabel}>{t('restaurants.about')}</Text>
              <Text style={s.infoValue}>{restaurant.about}</Text>
            </View>
          </View>
        )}

        {/* ── Reviews ── */}
        <Text style={s.sectionTitle}>{t('restaurants.reviews')}</Text>
        <ReviewSection entityType="restaurant" entityId={Number(id)} />

        {/* ── Action buttons ── */}
        {(hasPhone || restaurant.websiteUrl || restaurant.googleMapsUri || hasLocation || hasAddress) && (
          <View style={s.actions}>
            {hasPhone && (
              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                onPress={() => openCall(restaurant.phone!)}
              >
                <View style={[s.actionIconBox, { backgroundColor: C.typeParveBg }]}>
                  <MaterialIcons name="call" size={22} color={C.typeParve} />
                </View>
                <View style={s.actionContent}>
                  <Text style={s.actionTitle}>{t('restaurants.call')}</Text>
                  <Text style={s.actionSub}>{restaurant.phone}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
              </Pressable>
            )}

            {restaurant.websiteUrl && (
              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                onPress={() => openWebsite(restaurant.websiteUrl!)}
              >
                <View style={[s.actionIconBox, { backgroundColor: C.typeDairyBg }]}>
                  <MaterialIcons name="language" size={22} color={C.typeDairy} />
                </View>
                <View style={s.actionContent}>
                  <Text style={s.actionTitle}>{t('restaurants.website')}</Text>
                  <Text style={s.actionSub}>{t('restaurants.visitWebsite')}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
              </Pressable>
            )}

            {(restaurant.googleMapsUri || hasLocation || hasAddress) && (
              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                onPress={openGoogleMaps}
              >
                <View style={[s.actionIconBox, { backgroundColor: C.goldFaint }]}>
                  <MaterialIcons name="map" size={22} color={C.goldMuted} />
                </View>
                <View style={s.actionContent}>
                  <Text style={s.actionTitle}>{t('restaurants.viewOnMap')}</Text>
                  <Text style={s.actionSub}>
                    {restaurant.googleMapsUri ? t('restaurants.openInGoogleMaps') : hasLocation ? t('restaurants.openInMaps') : restaurant.address}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
              </Pressable>
            )}
          </View>
        )}
        {/* ── Report ── */}
        <View style={s.bottomActions}>
          <Pressable
            style={s.ghostBtn}
            onPress={() => requireAuth(() => setReportVisible(true), { reason: 'report' })}
          >
            <MaterialIcons name="flag" size={16} color="#DC2626" />
            <Text style={[s.ghostBtnText, { color: '#DC2626' }]}>{t('restaurants.report')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {restaurant && (
        <>
          <ReportModal
            visible={reportVisible}
            onClose={() => setReportVisible(false)}
            entityType="restaurant"
            entityId={restaurant.id}
            entityName={restaurant.name}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },
  errorText:    { fontSize: 16, color: C.textMuted, marginBottom: 16 },
  backLink:     { padding: 12 },
  backLinkText: { color: C.navy, fontSize: 16 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 44, left: 18 },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 4,
    borderColor: C.card,
    shadowColor: C.cardShadow,
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerContent: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerName: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Inter-Black', fontWeight: '900',
    color: C.navy,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 13, color: C.textSecondary, letterSpacing: 0.1, marginTop: 6 },
  googleName: { fontSize: 11.5, color: C.textMuted, marginTop: 5, maxWidth: '100%' },
  headerPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  ratingPill: {
    backgroundColor: C.goldFaint,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  ratingPillText: { fontSize: 12, color: C.navy, fontFamily: 'Inter-ExtraBold', fontWeight: '800' },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.goldFaint,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  distanceText: { fontSize: 12, color: C.navy, fontFamily: 'Inter-ExtraBold', fontWeight: '800' },

  // ── Body ────────────────────────────────────────────────────────────────────
  body: { padding: 18, gap: 12 },

  photoCard: {
    height: 170,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: '#F3EFE7',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroPhoto: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(11,23,54,0.72)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  photoBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter-Bold', fontWeight: '700' },

  // Type + kashrut card
  typeCard:    {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0EDE6',
  },
  badgeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  chipText:    { fontSize: 12, fontFamily: 'Inter-Bold', fontWeight: '700', letterSpacing: 0.1 },
  kashrutDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 19 },

  // Info rows
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: C.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3EFE7',
    gap: 12,
  },
  infoIcon:  { marginTop: 1 },
  infoText:  { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontFamily: 'Inter-ExtraBold', fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoValue: { fontSize: 15, color: C.textPrimary, lineHeight: 22 },

  sectionTitle: {
    fontSize: 15, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy,
    letterSpacing: 0.1, marginBottom: 2, marginTop: 2,
  },

  bottomActions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12,
    borderColor: '#F0EDE6', backgroundColor: C.card,
  },
  ghostBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', fontWeight: '700' },

  // Action buttons
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    gap: 14,
    shadowColor: C.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3EFE7',
  },
  actionBtnPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: { flex: 1 },
  actionTitle:   { fontSize: 15, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.textPrimary },
  actionSub:     { fontSize: 12, color: C.textMuted, marginTop: 2 },
});
