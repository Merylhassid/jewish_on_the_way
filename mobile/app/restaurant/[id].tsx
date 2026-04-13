import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '@/src/api/client';

interface Restaurant {
  id: number;
  name: string;
  restaurantType: string;
  kashrutLevel: string;
  address?: string;
  openingHours?: string;
  createdAt: string;
  destination?: { id: number; city: string; country: string };
}

const TYPE_EMOJI: Record<string, string> = { meat: '🥩', dairy: '🧀', parve: '🥗', pareve: '🥗', unknown: '🍽️' };
const TYPE_LABEL: Record<string, string> = { meat: 'Meat', dairy: 'Dairy', parve: 'Parve', pareve: 'Pareve', unknown: 'Unknown' };
const TYPE_COLOR: Record<string, string> = { meat: '#fdecea', dairy: '#e3f2fd', parve: '#e8f5e9', pareve: '#e8f5e9', unknown: '#f5f5f5' };

const KASHRUT_INFO: Record<string, { label: string; color: string; description: string }> = {
  rabbinate: { label: 'Rabbinate', color: '#9e9e9e', description: 'Certified by the local rabbinate' },
  mehadrin:  { label: 'Mehadrin',  color: '#2196f3', description: 'Higher standard of kashrut supervision' },
  badatz:    { label: 'Badatz',    color: '#4caf50', description: 'Strictest kashrut certification' },
  unknown:   { label: 'Kosher',    color: '#9e9e9e', description: 'Kosher certified' },
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export default function RestaurantDetailScreen() {
  const { id, distance } = useLocalSearchParams<{ id: string; distance?: string }>();
  const distanceMeters = distance ? parseInt(distance, 10) : undefined;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    client.get(`/restaurants/${id}`)
      .then((res) => setRestaurant(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>;
  }

  if (error || !restaurant) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Restaurant not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  const kashrut = KASHRUT_INFO[restaurant.kashrutLevel] ?? KASHRUT_INFO.unknown;
  const bgColor = TYPE_COLOR[restaurant.restaurantType] ?? TYPE_COLOR.unknown;
  const emoji   = TYPE_EMOJI[restaurant.restaurantType] ?? TYPE_EMOJI.unknown;
  const typeLabel = TYPE_LABEL[restaurant.restaurantType] ?? 'Unknown';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1a3a6b' }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerEmoji}>{emoji}</Text>
        <Text style={styles.headerName}>{restaurant.name}</Text>
        {restaurant.destination && (
          <Text style={styles.headerSub}>
            📍 {restaurant.destination.city}, {restaurant.destination.country}
          </Text>
        )}
        {distanceMeters !== undefined && (
          <Text style={styles.headerDistance}>📏 {formatDistance(distanceMeters)}</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Type + Kashrut badges */}
        <View style={[styles.typeCard, { backgroundColor: bgColor }]}>
          <View style={styles.badgeRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{emoji} {typeLabel}</Text>
            </View>
            <View style={[styles.kashrutChip, { backgroundColor: kashrut.color }]}>
              <Text style={styles.kashrutChipText}>{kashrut.label}</Text>
            </View>
          </View>
          <Text style={styles.kashrutDesc}>{kashrut.description}</Text>
        </View>

        {/* Details */}
        {restaurant.address && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Address</Text>
            <Text style={styles.infoValue}>📍  {restaurant.address}</Text>
          </View>
        )}

        {restaurant.openingHours && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Opening Hours</Text>
            <Text style={styles.infoValue}>🕐  {restaurant.openingHours}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4ff' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:      { fontSize: 16, color: '#888', marginBottom: 16 },
  backLink:       { padding: 12 },
  backLinkText:   { color: '#1a3a6b', fontSize: 16 },
  header:         { paddingTop: 60, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  backBtn:        { position: 'absolute', top: 60, left: 20 },
  backText:       { fontSize: 24, color: '#fff' },
  headerEmoji:    { fontSize: 52, marginBottom: 10 },
  headerName:     { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 6 },
  headerSub:      { fontSize: 14, color: '#a8c4e8' },
  headerDistance: { fontSize: 13, color: '#ffd700', fontWeight: '600', marginTop: 4 },
  body:           { padding: 16, gap: 12 },
  typeCard:       { borderRadius: 16, padding: 16 },
  badgeRow:       { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeChip:       { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  typeChipText:   { fontSize: 14, fontWeight: '600', color: '#333' },
  kashrutChip:    { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  kashrutChipText:{ fontSize: 14, fontWeight: '600', color: '#fff' },
  kashrutDesc:    { fontSize: 13, color: '#555' },
  infoCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  infoTitle:      { fontSize: 12, fontWeight: '700', color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  infoValue:      { fontSize: 15, color: '#333', lineHeight: 22 },
});
