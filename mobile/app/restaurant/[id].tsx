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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import ReviewSection from '@/src/components/ReviewSection';
import ReportModal from '@/src/components/ReportModal';
import FavoriteButton from '@/src/components/FavoriteButton';

interface Restaurant {
  id: number;
  name: string;
  restaurantType: string | null;
  kashrutLevel: string;
  address?: string;
  phone?: string;
  category?: string;
  openingHours?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  destination?: { id: number; city: string; country: string };
}

const TYPE_COLOR: Record<string, string> = {
  meat:    '#FFF5F0',
  dairy:   '#F0F7FF',
  pareve:  '#F0FFF4',
  parve:   '#F0FFF4',
  unknown: '#F8F9FF',
};
const TYPE_ICON: Record<string, React.ComponentProps<typeof MaterialIcons>['name']> = {
  meat:    'restaurant',
  dairy:   'local-cafe',
  pareve:  'eco',
  parve:   'eco',
  unknown: 'restaurant-menu',
};
const TYPE_TINT: Record<string, string> = {
  meat:    '#DC2626',
  dairy:   '#2563EB',
  pareve:  '#059669',
  parve:   '#059669',
  unknown: C.navy,
};

export default function RestaurantDetailScreen() {
  const { t } = useTranslation();

  const TYPE_LABEL: Record<string, string> = {
    meat:    t('restaurants.meat'),
    dairy:   t('restaurants.dairy'),
    pareve:  t('restaurants.pareve'),
    parve:   t('restaurants.pareve'),
    unknown: t('restaurants.unknownType'),
  };

  const KASHRUT: Record<string, { label: string; color: string; desc: string }> = {
    rabbinate: { label: t('restaurants.rabbinate'), color: '#6B7280', desc: t('restaurants.rabbinateDesc') },
    mehadrin:  { label: t('restaurants.mehadrin'),  color: '#2563EB', desc: t('restaurants.mehadrinDesc') },
    badatz:    { label: t('restaurants.badatz'),    color: '#059669', desc: t('restaurants.badatzDesc') },
    unknown:   { label: t('restaurants.kosher'),    color: '#6B7280', desc: t('restaurants.kosherDesc') },
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

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: typeTint }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <View style={s.backCircle}>
            <MaterialIcons name="arrow-back" size={20} color="#fff" />
          </View>
        </Pressable>

        <View style={s.headerIconRing}>
          <MaterialIcons name={typeIcon} size={32} color="#fff" />
        </View>

        <Text style={s.headerName}>{restaurant.name}</Text>
        <View style={s.favRow}>
          <FavoriteButton entityType="restaurant" entityId={restaurant.id} size={26} color="#fff" />
        </View>

        {restaurant.destination && (
          <Text style={s.headerSub}>
            {restaurant.destination.city}, {restaurant.destination.country}
          </Text>
        )}

        {distanceMeters !== undefined && (
          <View style={s.distancePill}>
            <MaterialIcons name="place" size={12} color={C.goldBright} />
            <Text style={s.distanceText}>{formatDistance(distanceMeters)}</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Type + Kashrut ── */}
        <View style={[s.typeCard, { backgroundColor: typeBg }]}>
          <View style={s.badgeRow}>
            <View style={[s.chip, { borderColor: typeTint }]}>
              <MaterialIcons name={typeIcon} size={14} color={typeTint} />
              <Text style={[s.chipText, { color: typeTint }]}>{typeLabel}</Text>
            </View>
            <View style={[s.chip, { borderColor: kashrut.color, backgroundColor: kashrut.color }]}>
              <Text style={[s.chipText, { color: '#fff' }]}>{kashrut.label}</Text>
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

        {/* ── Reviews ── */}
        <Text style={s.sectionTitle}>{t('restaurants.reviews')}</Text>
        <ReviewSection entityType="restaurant" entityId={Number(id)} />

        {/* ── Action buttons ── */}
        {(hasPhone || hasLocation || hasAddress) && (
          <View style={s.actions}>
            {hasPhone && (
              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                onPress={() => openCall(restaurant.phone!)}
              >
                <View style={[s.actionIconBox, { backgroundColor: 'rgba(5,150,105,0.12)' }]}>
                  <MaterialIcons name="call" size={22} color="#059669" />
                </View>
                <View style={s.actionContent}>
                  <Text style={s.actionTitle}>{t('restaurants.call')}</Text>
                  <Text style={s.actionSub}>{restaurant.phone}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
              </Pressable>
            )}

            {(hasLocation || hasAddress) && (
              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                onPress={() => {
                  if (hasLocation) {
                    openMap(restaurant.lat!, restaurant.lng!, restaurant.name);
                  } else {
                    openMapByAddress(restaurant.address!);
                  }
                }}
              >
                <View style={[s.actionIconBox, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                  <MaterialIcons name="map" size={22} color="#2563EB" />
                </View>
                <View style={s.actionContent}>
                  <Text style={s.actionTitle}>{t('restaurants.viewOnMap')}</Text>
                  <Text style={s.actionSub}>
                    {hasLocation ? t('restaurants.openInMaps') : restaurant.address}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
              </Pressable>
            )}
          </View>
        )}
        {/* ── Report ── */}
        <View style={s.bottomActions}>
          <Pressable style={s.ghostBtn} onPress={() => setReportVisible(true)}>
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
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 44, left: 18 },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 6,
    ...(Platform.OS === 'ios' ? { fontFamily: 'Georgia' } : {}),
  },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.70)', letterSpacing: 0.3 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.20)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  distanceText: { fontSize: 12, color: C.goldBright, fontWeight: '600' },

  // ── Body ────────────────────────────────────────────────────────────────────
  body: { padding: 18, gap: 12 },

  // Type + kashrut card
  typeCard:    { borderRadius: 18, padding: 16, gap: 10 },
  badgeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.60)',
  },
  chipText:    { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  kashrutDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 19 },

  // Info rows
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  infoIcon:  { marginTop: 1 },
  infoText:  { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoValue: { fontSize: 15, color: C.textPrimary, lineHeight: 22 },

  favRow: { marginTop: 8 },
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: C.textSecondary,
    letterSpacing: 0.5, marginBottom: 2,
  },

  bottomActions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12,
    borderColor: 'rgba(0,0,0,0.10)', backgroundColor: C.card,
  },
  ghostBtnText: { fontSize: 13, fontWeight: '700' },

  // Action buttons
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  actionTitle:   { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  actionSub:     { fontSize: 12, color: C.textMuted, marginTop: 2 },
});
