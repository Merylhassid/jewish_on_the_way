import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
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
import HomeButton from '@/src/components/HomeButton';
import {
  calculateHaversineDistance,
  formatDistance,
  extractCoordinates,
} from '@/src/utils/distance';

interface Synagogue {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  location?: { coordinates: [number, number] };
  distanceMeters?: number;
}

export default function SynagoguesScreen() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const [synagogues, setSynagogues] = useState<Synagogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Request location permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } catch {
          // Silent - location will remain unavailable
        }
      }
    })();
  }, []);

  useEffect(() => {
    const fetchSynagogues = async () => {
      try {
        setLoading(true);
        const res = await client.get('/synagogues', {
          params: { destinationId },
        });
        let data = Array.isArray(res.data) ? res.data : [];

        // Calculate distance if user location is available
        if (userLocation) {
          data = data.map((synagogue) => {
            const coords = extractCoordinates(synagogue.location);
            if (coords) {
              const [lat2, lon2] = coords;
              const distance = calculateHaversineDistance(
                userLocation.lat,
                userLocation.lng,
                lat2,
                lon2
              );
              return { ...synagogue, distanceMeters: distance };
            }
            return synagogue;
          });

          // Sort by distance (nearest first)
          data.sort((a, b) => {
            const distA = a.distanceMeters ?? Infinity;
            const distB = b.distanceMeters ?? Infinity;
            return distA - distB;
          });
        }

        setSynagogues(data);
      } catch (error) {
        // silent
      } finally {
        setLoading(false);
      }
    };

    if (destinationId) {
      fetchSynagogues();
    }
  }, [destinationId, userLocation]);

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

  const hasSomeDistance = synagogues.some(
    (s) => s.distanceMeters !== undefined
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.headerTitle}>🕍 Synagogues</Text>
        <Text style={styles.headerSub}>
          {loading
            ? 'Loading…'
            : `${synagogues.length} synagogue${synagogues.length !== 1 ? 's' : ''} found${
                hasSomeDistance ? '  •  📍 distance shown' : ''
              }`}
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
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleSection}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {item.distanceMeters !== undefined && (
                    <Text style={styles.distance}>
                      {formatDistance(item.distanceMeters)}
                    </Text>
                  )}
                </View>
              </View>
              {item.address && (
                <Text style={styles.meta}>📍 {item.address}</Text>
              )}
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
              <Text style={styles.emptyText}>
                No synagogues found for this destination
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f6fa' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  header: {
    backgroundColor: '#5E35B1',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 24, color: '#fff' },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  distance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E35B1',
    marginLeft: 8,
  },
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
