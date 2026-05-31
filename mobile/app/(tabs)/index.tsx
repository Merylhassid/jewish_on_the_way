import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

interface Destination {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  hasChildren?: boolean;
  distanceMeters?: number;
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

export default function DestinationsScreen() {
  const { t } = useTranslation();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Request location silently on mount — never block the UI
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Location unavailable — app still works without distance
      }
    })();

    AsyncStorage.getItem('lastDestinationId').then((id) => {
      if (id) router.push(`/destination/${id}`);
    });
  }, []);

  const fetchDestinations = async (q?: string) => {
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (userLocation) {
        params.lat = String(userLocation.lat);
        params.lng = String(userLocation.lng);
      }
      const res = await client.get('/destinations', { params });
      setDestinations(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when location becomes available (adds distances + re-sorts)
  useEffect(() => {
    if (userLocation) fetchDestinations(search || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.eyebrow}>JEWISH ON THE WAY</Text>
        <Text style={s.title}>{t('home.title')}</Text>
        <Text style={s.subtitle}>{t('home.subtitle')}</Text>

        <View style={s.searchBar}>
          <Text style={s.searchGlyph}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder={t('home.searchPlaceholder').replace('🔍  ', '')}
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              fetchDestinations(text || undefined);
            }}
          />
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : (
        <FlatList
          data={destinations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <DestinationCard
              item={item}
              onPress={() => {
                AsyncStorage.setItem('lastDestinationId', String(item.id));
                router.push(
                  item.hasChildren
                    ? `/destination/${item.id}/subdestinations`
                    : `/destination/${item.id}`,
                );
              }}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyDot}>◆</Text>
              <Text style={s.emptyText}>{t('home.noResults')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DestinationCard({
  item,
  onPress,
}: {
  item: Destination;
  onPress: () => void;
}) {
  const imageUrl = getDestinationImageUrl(item.city, item.countryCode);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
    >
      {/* ── Background photo ── */}
      <Image
        source={{ uri: imageUrl }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={500}
      />

      {/* ── Layered dark overlays for depth ── */}
      <View style={s.overlayTop} />
      <View style={s.overlayBottom} />

      {/* ── Gold left accent bar ── */}
      <View style={s.accentBar} />

      {/* ── Country code badge — top right ── */}
      <View style={s.codeBadge}>
        <Text style={s.codeText}>{item.countryCode}</Text>
      </View>

      {/* ── City + country text — bottom left ── */}
      <View style={s.cardBody}>
        <Text style={s.cityName} numberOfLines={1}>{item.city}</Text>
        <Text style={s.countryName}>{item.country}</Text>
      </View>

      {/* ── Distance + arrow — bottom right ── */}
      <View style={s.rightStack}>
        {item.distanceMeters !== undefined && (
          <View style={s.distanceBadge}>
            <Text style={s.distanceText}>
              {formatDistance(Number(item.distanceMeters))}
            </Text>
          </View>
        )}
        <View style={s.arrowWrap}>
          <Text style={s.arrowGlyph}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F5FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.navyDeep,
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingHorizontal: 24,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 3,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: C.onDark,
    letterSpacing: 0.2,
    marginBottom: 4,
    ...(Platform.OS === 'ios' ? { fontFamily: 'Georgia' } : {}),
  },
  subtitle: {
    fontSize: 14,
    color: C.onDarkMuted,
    marginBottom: 22,
    lineHeight: 21,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
  },
  searchGlyph: { fontSize: 18, color: '#C9A84C', marginRight: 10 },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  list: { padding: 16, gap: 14, paddingBottom: 32 },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    height: 165,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  cardPressed: { opacity: 0.86, transform: [{ scale: 0.982 }] },

  overlayTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 13, 36, 0.35)',
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: 'rgba(5, 13, 36, 0.75)',
  },

  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: C.gold,
  },

  // Country code badge — top right
  codeBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.goldBright,
    letterSpacing: 1.5,
  },

  // City + country — bottom left
  cardBody: {
    position: 'absolute',
    left: 18,
    bottom: 16,
    right: 100,
  },
  cityName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    ...(Platform.OS === 'ios' ? { fontFamily: 'Georgia' } : {}),
  },
  countryName: {
    fontSize: 12,
    fontWeight: '600',
    color: C.goldBright,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Distance badge + arrow — bottom right stack
  rightStack: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    alignItems: 'center',
    gap: 6,
  },
  distanceBadge: {
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.goldBright,
    letterSpacing: 0.5,
  },
  arrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.goldFaint,
    borderWidth: 1,
    borderColor: C.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowGlyph: {
    fontSize: 20,
    color: C.gold,
    fontWeight: '700',
    lineHeight: 24,
    marginLeft: 2,
  },

  // ── Empty ─────────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyDot: { fontSize: 24, color: C.gold, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.textMuted, letterSpacing: 0.3 },
});
