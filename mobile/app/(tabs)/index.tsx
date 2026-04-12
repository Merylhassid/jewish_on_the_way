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
import client from '@/src/api/client';

interface Destination {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
}

function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
}

export default function DestinationsScreen() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDestinations = async (q?: string) => {
    try {
      const res = await client.get('/destinations', { params: q ? { q } : {} });
      setDestinations(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // On mount: load destinations and redirect to last visited destination if any
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
        <Text style={styles.headerTitle}>✡️ Jewish On The Way</Text>
        <Text style={styles.headerSub}>Where are you traveling?</Text>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.search}
          placeholder="🔍  Search a city..."
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
            onPress={() => {
              AsyncStorage.setItem('lastDestinationId', String(item.id));
              router.push(`/destination/${item.id}`);
            }}
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
          <Text style={styles.empty}>No destinations found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1a3a6b',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#a8c4e8' },
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
