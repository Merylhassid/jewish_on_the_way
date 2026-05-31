import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import client from '@/src/api/client';
import HomeButton from '@/src/components/HomeButton';

interface Restaurant {
  id: number;
  name: string;
  restaurantType: string | null;
  kashrutLevel: string;
  address?: string;
  openingHours?: string;
  distanceMeters?: number;
  destinationCity?: string;
}

const TYPE_EMOJI: Record<string, string> = { meat: '🥩', dairy: '🧀', parve: '🥗', pareve: '🥗', unknown: '🍽️' };
const TYPE_COLOR: Record<string, string> = { meat: '#fdecea', dairy: '#e3f2fd', parve: '#e8f5e9', pareve: '#e8f5e9', unknown: '#f5f5f5' };
const KASHRUT_BADGE: Record<string, { label: string; color: string }> = {
  rabbinate: { label: 'Rabbinate', color: '#9e9e9e' },
  mehadrin:  { label: 'Mehadrin',  color: '#2196f3' },
  badatz:    { label: 'Badatz',    color: '#4caf50' },
  unknown:   { label: 'Kosher',    color: '#9e9e9e' },
};

const TYPE_FILTERS   = ['all', 'meat', 'dairy', 'parve'];
const KASHRUT_FILTERS = ['all', 'rabbinate', 'mehadrin', 'badatz'];

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function RestaurantsScreen() {
  const { destinationId, city, type: typeParam, kashrut: kashrutParam, fromParent } =
    useLocalSearchParams<{ destinationId: string; city?: string; type?: string; kashrut?: string; fromParent?: string }>();
  const isCountryMode = fromParent === 'true';
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(false);
  const [typeFilter, setTypeFilter]       = useState(typeParam && TYPE_FILTERS.includes(typeParam) ? typeParam : 'all');
  const [kashrutFilter, setKashrutFilter] = useState(kashrutParam && KASHRUT_FILTERS.includes(kashrutParam) ? kashrutParam : 'all');
  const [search, setSearch] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [lastAiQuery, setLastAiQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request location once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  // Re-fetch whenever filters, AI mode, or location change
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = isCountryMode
          ? { parentDestinationId: destinationId }
          : { destinationId };
        if (userLocation?.lat) params.lat = String(userLocation.lat);
        if (userLocation?.lng) params.lng = String(userLocation.lng);

        let endpoint = '/restaurants';
        if (aiMode && search.trim()) {
          // req 4.3.1 — AI classifier endpoint: extracts type/kashrut from free text
          endpoint = '/restaurants/search';
          params.q = search.trim();
          setLastAiQuery(search.trim());
        } else {
          if (typeFilter    && typeFilter    !== 'all') params.type    = typeFilter;
          if (kashrutFilter && kashrutFilter !== 'all') params.kashrut = kashrutFilter;
          if (search) params.q = search;
        }

        const res = await client.get(endpoint, { params });
        setRestaurants(res.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [typeFilter, kashrutFilter, search, aiMode, userLocation, destinationId]);

  // When user taps a restaurant in AI mode, record the click so Claude can learn
  const sendAiFeedback = (item: Restaurant) => {
    if (!aiMode || !lastAiQuery) return;
    client
      .post('/restaurants/search/feedback', {
        query: lastAiQuery,
        clickedRestaurantName: item.name,
        clickedRestaurantType: item.restaurantType,
        clickedRestaurantKashrut: item.kashrutLevel,
      })
      .catch(() => {/* silent — feedback is best-effort */});
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.headerTitle}>🍽️ Kosher Restaurants{city ? ` — ${city}` : ''}</Text>
        <Text style={styles.headerSub}>
          {loading ? 'Loading…' : `${restaurants.length} restaurant${restaurants.length !== 1 ? 's' : ''} found`}
          {userLocation ? '  •  📍 sorted by distance' : ''}
        </Text>
      </View>

      {/* Search + AI toggle */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder={aiMode ? '✨  e.g. "badatz steak place" or "dairy near me"…' : '🔍  Search restaurants…'}
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        <Pressable
          style={[styles.aiToggle, aiMode && styles.aiToggleActive]}
          onPress={() => { setAiMode((v) => !v); setSearch(''); }}
        >
          <Text style={[styles.aiToggleText, aiMode && styles.aiToggleTextActive]}>
            ✨ AI
          </Text>
        </Pressable>
      </View>

      {/* Filters — hidden in AI mode (AI extracts them from text) */}
      {!aiMode && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
            {TYPE_FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.chip, typeFilter === f && styles.chipActive]}
                onPress={() => setTypeFilter(f)}
              >
                <Text style={[styles.chipText, typeFilter === f && styles.chipTextActive]}>
                  {f === 'all' ? 'All types' : `${TYPE_EMOJI[f]} ${formatLabel(f)}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
            {KASHRUT_FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.chip, kashrutFilter === f && styles.chipActive]}
                onPress={() => setKashrutFilter(f)}
              >
                <Text style={[styles.chipText, kashrutFilter === f && styles.chipTextActive]}>
                  {f === 'all' ? 'All kashrut' : formatLabel(f)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {aiMode && search.trim().length > 0 && (
        <View style={styles.aiHint}>
          <Text style={styles.aiHintText}>✨ AI is detecting type, kashrut & keywords from your text</Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ fontSize: 15, color: '#888', marginBottom: 16 }}>שגיאה בטעינת הנתונים</Text>
          <Pressable
            style={{ backgroundColor: '#1a3a6b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => { setError(false); setLoading(true); }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>🔄 נסה שוב</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setError(false); }}
              colors={['#1a3a6b']}
              tintColor="#1a3a6b"
            />
          }
          renderItem={({ item }) => {
            const badge   = KASHRUT_BADGE[item.kashrutLevel] ?? KASHRUT_BADGE.unknown;
            const bgColor = TYPE_COLOR[item.restaurantType]  ?? TYPE_COLOR.unknown;
            const emoji   = TYPE_EMOJI[item.restaurantType]  ?? TYPE_EMOJI.unknown;
            return (
              <Pressable
                style={[styles.card, { backgroundColor: bgColor }]}
                onPress={() => {
                  sendAiFeedback(item);
                  const dist = item.distanceMeters !== undefined ? `?distance=${item.distanceMeters}` : '';
                  router.push(`/restaurant/${item.id}${dist}`);
                }}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.emoji}>{emoji}</Text>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardType}>
                      {formatLabel(item.restaurantType)}
                    </Text>
                  </View>
                  <View style={styles.rightCol}>
                    <View style={[styles.badge, { backgroundColor: badge.color }]}>
                      <Text style={styles.badgeText}>{badge.label}</Text>
                    </View>
                    {item.distanceMeters !== undefined && (
                      <Text style={styles.distance}>{formatDistance(Number(item.distanceMeters))}</Text>
                    )}
                  </View>
                </View>
                {item.destinationCity && <Text style={styles.cityTag}>🏙️ {item.destinationCity}</Text>}
                {item.address     && <Text style={styles.meta}>📍 {item.address}</Text>}
                {item.openingHours && <Text style={styles.meta}>🕐 {item.openingHours}</Text>}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyText}>No restaurants match your filters</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f0f4ff' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  header:      { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn:     { marginBottom: 10 },
  backText:    { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSub:   { fontSize: 13, color: '#a8c4e8' },
  searchWrapper: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#f0f4ff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1a1a2e' },
  aiToggle: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  aiToggleActive: { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  aiToggleText: { fontSize: 13, fontWeight: '700', color: '#555' },
  aiToggleTextActive: { color: '#fff' },
  aiHint: { backgroundColor: '#e8f4fd', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#bee3f8' },
  aiHintText: { fontSize: 12, color: '#0277bd', fontStyle: 'italic' },
  filterRow:   { maxHeight: 48, backgroundColor: '#fff' },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  chipActive:  { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  chipText:    { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  list:        { padding: 16, gap: 12 },
  card:        { borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  emoji:       { fontSize: 28, marginRight: 12 },
  cardInfo:    { flex: 1 },
  cardName:    { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  cardType:    { fontSize: 13, color: '#666', marginTop: 2 },
  rightCol:    { alignItems: 'flex-end', gap: 4 },
  badge:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '600' },
  distance:    { fontSize: 12, color: '#555', fontWeight: '500' },
  meta:        { fontSize: 13, color: '#555', marginBottom: 2 },
  cityTag:     { fontSize: 12, color: '#1a3a6b', fontWeight: '600', marginBottom: 3 },
  empty:       { alignItems: 'center', marginTop: 60 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { fontSize: 15, color: '#888', textAlign: 'center' },
});
