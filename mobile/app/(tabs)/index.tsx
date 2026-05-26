import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDestinations = async (q?: string) => {
    try {
      setError(false);
      const res = await client.get('/destinations', { params: q ? { q } : {} });
      setDestinations(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
    AsyncStorage.getItem('lastDestinationId').then((id) => {
      if (id) router.push(`/destination/${id}`);
    });
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
                AsyncStorage.setItem('lastDestinationId', String(item.id));
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

  emptyBox: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#8A96B0', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0C2461', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
