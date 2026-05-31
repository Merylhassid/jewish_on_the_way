import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';

interface Destination {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  hasChildren?: boolean;
}

function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
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

  useEffect(() => {
    fetchDestinations();
  }, []);

  const onSearch = (text: string) => {
    setSearch(text);
    fetchDestinations(text || undefined);
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('home.title')}</Text>
        <Text style={styles.headerSub}>{t('home.subtitle')}</Text>
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.searchPlaceholder').replace('🔍  ', '')}
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={search}
            onChangeText={onSearch}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0C2461" />
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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => {
                const path = item.hasChildren
                  ? `/destination/${item.id}/subdestinations`
                  : `/destination/${item.id}`;
                router.push(path);
              }}
            >
              <Text style={styles.flag}>{flagEmoji(item.countryCode)}</Text>
              <View style={styles.cardInfo}>
                <Text style={styles.cardCity}>{item.city}</Text>
                <Text style={styles.cardCountry}>{item.country}</Text>
              </View>
              <View style={styles.chevronBadge}>
                <Text style={styles.chevronText}>›</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>{t('home.noResults')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#0C2461',
    paddingTop: 64,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 3, letterSpacing: 0.2 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 18 },

  searchWrapper: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },

  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0C2461',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  flag: { fontSize: 38, marginRight: 16 },
  cardInfo: { flex: 1 },
  cardCity: { fontSize: 17, fontWeight: '700', color: '#0C1A2E' },
  cardCountry: { fontSize: 13, color: '#8A96B0', marginTop: 2 },
  chevronBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F2F5FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronText: { fontSize: 18, color: '#0C2461', fontWeight: '700', lineHeight: 22 },

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
  emptyText: { fontSize: 15, color: '#8A96B0', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0C2461', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
