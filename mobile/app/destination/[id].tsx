import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

interface Destination {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  description?: string;
}

type ServiceKey = 'restaurants' | 'synagogues' | 'minyans' | 'hosting' | 'chat';

interface Service {
  key: ServiceKey;
  label: string;
  sub: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bg: string;
}

const SERVICES: Service[] = [
  {
    key:   'restaurants',
    label: 'Kosher Restaurants',
    sub:   'Certified kosher dining',
    icon:  'restaurant',
    color: '#059669',
    bg:    'rgba(5,150,105,0.10)',
  },
  {
    key:   'synagogues',
    label: 'Synagogues',
    sub:   'Shul finder & times',
    icon:  'account-balance',
    color: '#7C3AED',
    bg:    'rgba(124,58,237,0.10)',
  },
  {
    key:   'minyans',
    label: 'Minyans',
    sub:   'Prayer group schedules',
    icon:  'groups',
    color: C.gold,
    bg:    C.goldFaint,
  },
  {
    key:   'hosting',
    label: 'Shabbat Hosting',
    sub:   'Find a Shabbat table',
    icon:  'home',
    color: '#DB2777',
    bg:    'rgba(219,39,119,0.10)',
  },
  {
    key:   'chat',
    label: 'Traveler Chat',
    sub:   'Connect with travelers',
    icon:  'chat',
    color: '#0891B2',
    bg:    'rgba(8,145,178,0.10)',
  },
];

const ACTIVE: ServiceKey[] = ['restaurants', 'synagogues', 'chat', 'minyans', 'hosting'];

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(`/destinations/${id}`)
      .then((res) => setDestination(res.data))
      .catch(() => {
        AsyncStorage.removeItem('lastDestinationId');
        router.replace('/(tabs)');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (!destination) {
    return (
      <View style={s.center}>
        <Text style={s.notFound}>Destination not found</Text>
      </View>
    );
  }

  const imageUrl = getDestinationImageUrl(destination.city, destination.countryCode);

  return (
    <View style={s.root}>

      {/* ── Hero ── */}
      <View style={s.hero}>
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={600}
        />

        {/* Multi-layer overlay for cinematic depth */}
        <View style={s.heroOverlay1} />
        <View style={s.heroOverlay2} />

        {/* Back button */}
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={14}>
          <View style={s.backBtnCircle}>
            <MaterialIcons name="arrow-back" size={20} color="#fff" />
          </View>
        </Pressable>

        {/* Country code badge — top right */}
        <View style={s.codeBadge}>
          <Text style={s.codeText}>{destination.countryCode}</Text>
        </View>

        {/* Hero text — bottom */}
        <View style={s.heroBottom}>
          <Text style={s.heroCity}>{destination.city}</Text>
          <View style={s.countryPill}>
            <Text style={s.countryPillText}>{destination.country.toUpperCase()}</Text>
          </View>
          {destination.description ? (
            <Text style={s.heroDesc} numberOfLines={2}>
              {destination.description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Services ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.services}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionLabel}>EXPLORE</Text>

        {SERVICES.map((svc) => {
          const active = ACTIVE.includes(svc.key);
          return (
            <ServiceCard
              key={svc.key}
              svc={svc}
              active={active}
              onPress={() => {
                if (!active) return;
                if (svc.key === 'restaurants') router.push(`/restaurants/${id}`);
                else if (svc.key === 'synagogues') router.push(`/synagogues/${id}`);
                else if (svc.key === 'chat')       router.push(`/chat/${id}`);
                else if (svc.key === 'minyans')    router.push(`/minyans/${id}`);
                else if (svc.key === 'hosting')    router.push(`/hosting/${id}`);
              }}
            />
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ServiceCard({
  svc,
  active,
  onPress,
}: {
  svc: Service;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.card,
        !active && s.cardDimmed,
        pressed && active && s.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Colored left accent bar */}
      <View style={[s.cardBar, { backgroundColor: active ? svc.color : '#D1D5DB' }]} />

      {/* Icon circle */}
      <View style={[s.iconCircle, { backgroundColor: active ? svc.bg : 'rgba(0,0,0,0.04)' }]}>
        <MaterialIcons
          name={svc.icon}
          size={24}
          color={active ? svc.color : '#9CA3AF'}
        />
      </View>

      {/* Labels */}
      <View style={s.cardText}>
        <Text style={[s.cardLabel, !active && s.cardLabelDim]}>{svc.label}</Text>
        <Text style={[s.cardSub,   !active && s.cardSubDim]}>
          {active ? svc.sub : 'Coming soon'}
        </Text>
      </View>

      {/* Arrow */}
      {active ? (
        <View style={s.arrow}>
          <MaterialIcons name="chevron-right" size={20} color={C.gold} />
        </View>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.cream },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },
  notFound: { fontSize: 15, color: C.textMuted },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: { height: 320, justifyContent: 'flex-end' },

  heroOverlay1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 13, 36, 0.40)',
  },
  heroOverlay2: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 160,
    backgroundColor: 'rgba(5, 13, 36, 0.70)',
  },

  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 58 : 40, left: 18, zIndex: 10 },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  codeBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 40,
    right: 18,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  codeText: { fontSize: 11, fontWeight: '800', color: C.goldBright, letterSpacing: 1.5 },

  heroBottom: {
    paddingHorizontal: 22,
    paddingBottom: 26,
  },
  heroCity: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    ...(Platform.OS === 'ios' ? { fontFamily: 'Georgia' } : {}),
  },
  countryPill: {
    alignSelf: 'flex-start',
    backgroundColor: C.goldFaint,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
  },
  countryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.goldBright,
    letterSpacing: 1.8,
  },
  heroDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.60)',
    lineHeight: 20,
  },

  // ── Services ────────────────────────────────────────────────────────────────
  scroll: { flex: 1, backgroundColor: C.cream },
  services: { paddingHorizontal: 18, paddingTop: 22, gap: 12 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: 3,
    marginBottom: 6,
    marginLeft: 6,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 15,
    paddingRight: 14,
    shadowColor: C.navy,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cardDimmed: { opacity: 0.40 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.984 }] },

  cardBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 14,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  cardText:    { flex: 1 },
  cardLabel:   { fontSize: 16, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.1 },
  cardLabelDim:{ color: C.textMuted },
  cardSub:     { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  cardSubDim:  { color: C.textMuted },

  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.goldFaint,
    borderWidth: 1,
    borderColor: C.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
