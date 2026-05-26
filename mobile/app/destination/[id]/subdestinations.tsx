import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

export default function SubdestinationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [parent, setParent] = useState<Destination | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSubdestinations = async (q?: string) => {
    try {
      const params: Record<string, string> = { parentId: String(id) };
      if (q) params.q = q;
      const res = await client.get('/destinations', { params });
      setDestinations(res.data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    setLoading(true);
    if (!id) return;

    Promise.all([
      client.get(`/destinations/${id}`),
      client.get('/destinations', { params: { parentId: String(id) } }),
    ])
      .then(([parentRes, childrenRes]) => {
        setParent(parentRes.data);
        setDestinations(childrenRes.data);
      })
      .catch(() => {
        router.replace('/(tabs)');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const onSearch = (text: string) => {
    setSearch(text);
    fetchSubdestinations(text || undefined);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a3a6b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.flag}>{parent ? flagEmoji(parent.countryCode) : ''}</Text>
        <Text style={styles.headerTitle}>{parent?.city || 'Choose destination'}</Text>
        <View style={styles.countryBadge}>
          <Text style={styles.headerSub}>
            {parent?.country ? `Locations in ${parent.country}` : 'Choose a sub-destination'}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.search}
          placeholder="🔍 Search a sub-destination..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={onSearch}
        />
      </View>

      <FlatList
        data={destinations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/destination/${item.id}`)}
          >
            <Text style={styles.flag}>{flagEmoji(item.countryCode)}</Text>
            <View style={styles.cardInfo}>
              <Text style={styles.cardCity}>{item.city}</Text>
              <Text style={styles.cardCountry}>{item.country}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No sub-destinations found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#0C2461',
    paddingTop: 64,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', top: 62, left: 20 },
  backText: { fontSize: 30, color: 'rgba(255,255,255,0.85)', lineHeight: 34 },
  flag: { fontSize: 58, marginBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: 0.2 },
  countryBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  searchWrapper: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  search: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  flag: { fontSize: 36, marginRight: 14 },
  cardInfo: { flex: 1 },
  cardCity: { fontSize: 17, fontWeight: '600', color: '#1a1a2e' },
  cardCountry: { fontSize: 13, color: '#888', marginTop: 2 },
  arrow: { fontSize: 24, color: '#bbb' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});
