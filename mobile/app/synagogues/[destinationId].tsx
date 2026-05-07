import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '@/src/api/client';

interface Synagogue {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  location?: { coordinates: [number, number] };
}

export default function SynagoguesScreen() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const [synagogues, setSynagogues] = useState<Synagogue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSynagogues = async () => {
      try {
        setLoading(true);
        const res = await client.get('/synagogues', {
          params: { destinationId },
        });
        setSynagogues(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        // silent
      } finally {
        setLoading(false);
      }
    };

    if (destinationId) {
      fetchSynagogues();
    }
  }, [destinationId]);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      // silent
    });
  };

  const handleWebsite = (url: string) => {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    Linking.openURL(url).catch(() => {
      // silent
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🕍 Synagogues</Text>
        <Text style={styles.headerSub}>
          {loading ? 'Loading…' : `${synagogues.length} synagogue${synagogues.length !== 1 ? 's' : ''} found`}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5E35B1" />
        </View>
      ) : (
        <FlatList
          data={synagogues}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/synagogue/${item.id}`)}
            >
              <Text style={styles.cardName}>{item.name}</Text>
              {item.address && <Text style={styles.meta}>📍 {item.address}</Text>}
              <View style={styles.actions}>
                {item.phone && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => handleCall(item.phone!)}
                  >
                    <Text style={styles.actionText}>📞 Call</Text>
                  </Pressable>
                )}
                {item.website && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => handleWebsite(item.website!)}
                  >
                    <Text style={styles.actionText}>🌐 Visit</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🕍</Text>
              <Text style={styles.emptyText}>No synagogues found for this destination</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f6fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  header: { backgroundColor: '#5E35B1', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  meta: { fontSize: 13, color: '#666', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#5E35B1',
    borderRadius: 8,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#999' },
});
