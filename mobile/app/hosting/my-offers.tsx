import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '@/src/api/client';

interface HostingOffer {
  id: number;
  availableFrom: string;
  availableTo: string;
  maxGuests: number;
  allowsChildren: boolean;
  allowsShabbat: boolean;
  kashrutLevel: string | null;
  notes: string | null;
  is_active: boolean;
  destination: { id: number; city: string; country: string } | null;
}

export default function MyOffersScreen() {
  const [offers, setOffers] = useState<HostingOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await client.get('/hosting/offers/mine');
      setOffers(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const handleDeactivate = (id: number) => {
    Alert.alert('Deactivate Offer', 'Are you sure you want to deactivate this offer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/hosting/offers/${id}/deactivate`);
            loadOffers();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to deactivate');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🏠 My Hosting Offers</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a3a6b" />
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.is_active && styles.cardInactive]}>
              <View style={styles.cardTop}>
                <Text style={styles.cardCity}>
                  📍 {item.destination?.city ?? '—'},{' '}
                  {item.destination?.country ?? ''}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.is_active ? '#4caf50' : '#9e9e9e' },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {item.is_active ? '✅ Active' : '⛔ Inactive'}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardDates}>
                📅 {item.availableFrom} → {item.availableTo}
              </Text>

              <Text style={styles.cardMeta}>
                👥 Up to {item.maxGuests} guest{item.maxGuests !== 1 ? 's' : ''}
                {item.allowsShabbat ? '  •  🕍 Shabbat' : ''}
                {item.allowsChildren ? '  •  👨‍👩‍👧 Children' : ''}
                {item.kashrutLevel ? `  •  🍽️ ${item.kashrutLevel}` : ''}
              </Text>

              {item.notes ? (
                <Text style={styles.cardNotes}>📝 {item.notes}</Text>
              ) : null}

              {item.is_active ? (
                <TouchableOpacity
                  style={styles.deactivateBtn}
                  onPress={() => handleDeactivate(item.id)}
                >
                  <Text style={styles.deactivateBtnText}>⛔ Deactivate</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyText}>
                {'No hosting offers yet.\nCreate one to start hosting travelers!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1a3a6b',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardInactive: { opacity: 0.6 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardCity: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardDates: { fontSize: 13, color: '#555', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#777', marginBottom: 8 },
  cardNotes: { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 8 },
  deactivateBtn: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffcccc',
    backgroundColor: '#fff5f5',
    alignItems: 'center',
  },
  deactivateBtnText: { fontWeight: '700', fontSize: 14, color: '#f44336' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
});
