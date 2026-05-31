import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

const RECENT_KEY = 'recent_destinations';

async function addRecentDestination(dest: Destination) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Destination[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(d => d.id !== dest.id);
    filtered.unshift(dest);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 6)));
  } catch {}
}

async function loadRecentDestinations(): Promise<Destination[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function removeRecentDestination(id: number) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Destination[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list.filter(d => d.id !== id)));
  } catch {}
}

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
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ── חיפוש חכם ──────────────────────────────────────────────
  const [smartText, setSmartText] = useState('');
  const [smartBusy, setSmartBusy] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsReady, setGpsReady] = useState(false);

  const [recentDests, setRecentDests] = useState<Destination[]>([]);

  // live classification chip
  const [liveChip, setLiveChip] = useState<{ category: string; emoji: string; denomination: string | null; denomEmoji: string; denomLabel: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // בקשת GPS ברקע בטעינת הדף
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsReady(true);
      } catch { /* silent */ }
    })();
  }, []);

  const onSmartTextChange = (val: string) => {
    setSmartText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setLiveChip(null); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await client.get('/search/classify', { params: { text: val.trim() } });
        setLiveChip(res.data.category ? res.data : null);
      } catch { /* silent */ }
    }, 400);
  };

  const handleSmartSearch = async () => {
    const text = smartText.trim();
    if (!text) return;
    setLiveChip(null);
    try {
      setSmartBusy(true);
      const body: Record<string, any> = { text };
      if (userCoords) { body.lat = userCoords.lat; body.lng = userCoords.lng; }

      const res = await client.post('/search', body);
      const { route, category, emoji, detectedCity, error } = res.data;

      if (error === 'low_confidence') {
        Alert.alert('לא הבנתי 🤔', 'נסה לכתוב בצורה ברורה יותר.\nלמשל: "מסעדה כשרה בתל אביב" או "מניין בירושלים"');
        return;
      }

      if (!detectedCity) {
        Alert.alert(
          `${emoji} זיהינו: ${category}`,
          'לא זיהינו עיר ספציפית.\nנסה לכתוב למשל: "מסעדה כשרה בתל אביב"',
        );
        return;
      }

      const cityParam = detectedCity ? `${route.includes('?') ? '&' : '?'}city=${encodeURIComponent(detectedCity)}` : '';
      router.push((route + cityParam) as any);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לחפש כרגע, נסה שוב');
    } finally {
      setSmartBusy(false);
    }
  };

  const fetchDestinations = async (q?: string) => {
    try {
      setError(false);
      const res = await client.get('/destinations', { params: q ? { q } : {} });
      setDestinations(res.data);
      // שומרים את כל היעדים (ללא פילטר) לזיהוי עיר בחיפוש חכם
      if (!q) setAllDestinations(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + load recent
  useEffect(() => {
    fetchDestinations();
    loadRecentDestinations().then(setRecentDests);
  }, []);

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.savedBtn} onPress={() => router.push('/saved' as any)}>
          <MaterialIcons name="favorite" size={18} color={C.gold} />
          <Text style={s.savedBtnText}>Saved</Text>
        </Pressable>
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

      {/* ── Smart Search Card ── */}
      <View style={styles.smartCard}>
        <Text style={styles.smartTitle}>✨ חיפוש חכם</Text>
        <Text style={styles.smartSub}>
          כתוב בשפה חופשית מה אתה מחפש ואיפה{gpsReady ? '  •  📍 GPS מוכן' : ''}
        </Text>
        <View style={styles.smartRow}>
          <TextInput
            style={styles.smartInput}
            placeholder={'למשל: "מסעדה כשרה בתל אביב"'}
            placeholderTextColor="#8A96B0"
            value={smartText}
            onChangeText={onSmartTextChange}
            onSubmitEditing={handleSmartSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.smartBtn, (!smartText.trim() || smartBusy) && styles.smartBtnOff]}
            onPress={handleSmartSearch}
            disabled={!smartText.trim() || smartBusy}
          >
            {smartBusy
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.smartBtnText}>→</Text>
            }
          </TouchableOpacity>
        </View>
        {liveChip && (
          <View style={styles.liveChip}>
            <Text style={styles.liveChipText}>
              {liveChip.emoji} {liveChip.category}
              {liveChip.denomination ? `  •  ${liveChip.denomEmoji} ${liveChip.denomLabel}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* ── Recent destinations ── */}
      {recentDests.length > 0 && !search && (
        <View style={s.recentSection}>
          <Text style={s.recentLabel}>Recent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentRow}>
            {recentDests.map(d => (
              <View key={d.id} style={s.recentChip}>
                <Pressable
                  style={s.recentChipPress}
                  onPress={() => {
                    const path = d.hasChildren ? `/destination/${d.id}/subdestinations` : `/destination/${d.id}`;
                    router.push(path as any);
                  }}
                >
                  <MaterialIcons name="history" size={13} color={C.gold} />
                  <Text style={s.recentChipText}>{d.city || d.name}</Text>
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() => {
                    removeRecentDestination(d.id);
                    setRecentDests(prev => prev.filter(r => r.id !== d.id));
                  }}
                >
                  <MaterialIcons name="close" size={14} color="#999" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>שגיאה בטעינת היעדים</Text>
          <Pressable onPress={() => { setLoading(true); fetchDestinations(); }} style={styles.retryBtn}>
            <Text style={styles.retryText}>נסה שוב</Text>
          </Pressable>
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
                addRecentDestination(item);
                setRecentDests(prev => [item, ...prev.filter(d => d.id !== item.id)].slice(0, 6));
                const path = item.hasChildren
                  ? `/destination/${item.id}/subdestinations`
                  : `/destination/${item.id}`;
                router.push(path as any);
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

  // ── Saved button ─────────────────────────────────────────────────────────
  savedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-end', marginBottom: 8,
    backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)',
  },
  savedBtnText: { fontSize: 12, fontWeight: '700', color: C.gold },

  // ── Recent destinations ────────────────────────────────────────────────
  recentSection: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  recentLabel:   { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 8 },
  recentRow:     { gap: 8 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.card, borderRadius: 20,
    paddingLeft: 10, paddingRight: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#E5DCC8',
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  recentChipPress: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recentChipText: { fontSize: 13, fontWeight: '600', color: C.textPrimary },

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
  emptyText: { fontSize: 15, color: '#8A96B0', marginBottom: 16 },

  // Smart Search
  smartCard:    { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 18, padding: 16, shadowColor: '#0C2461', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  smartTitle:   { fontSize: 16, fontWeight: '800', color: '#0C2461', marginBottom: 2 },
  smartSub:     { fontSize: 12, color: '#8A96B0', marginBottom: 12 },
  smartRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smartInput:   { flex: 1, backgroundColor: '#F2F5FB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0C1A2E', borderWidth: 1, borderColor: '#E0E6F0' },
  smartBtn:     { backgroundColor: '#0C2461', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  smartBtnOff:  { backgroundColor: '#B0BAC8' },
  smartBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  liveChip:     { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#EDE7F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  liveChipText: { fontSize: 13, color: '#5E35B1', fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  retryBtn: { backgroundColor: '#0C2461', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const styles = s;
