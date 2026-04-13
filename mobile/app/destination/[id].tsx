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
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '@/src/api/client';

interface Destination {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  description?: string;
}

function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
}

const SERVICES = [
  { key: 'restaurants', icon: '🍽️', label: 'Kosher Restaurants', color: '#e8f4e8', border: '#4caf50' },
  { key: 'synagogues', icon: '🕍', label: 'Synagogues', color: '#e8eaf6', border: '#3f51b5' },
  { key: 'minyans', icon: '🤝', label: 'Minyans', color: '#fff3e0', border: '#ff9800' },
  { key: 'hosting', icon: '🏠', label: 'Shabbat Hosting', color: '#fce4ec', border: '#e91e63' },
  { key: 'chat', icon: '💬', label: 'Traveler Chat', color: '#e0f7fa', border: '#00bcd4' },
];

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(`/destinations/${id}`)
      .then((res) => setDestination(res.data))
      .catch(() => {
        // Stale lastDestinationId (e.g. from old DB) — clear it and go home
        AsyncStorage.removeItem('lastDestinationId');
        router.replace('/(tabs)');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>;
  }

  if (!destination) {
    return <View style={styles.center}><Text>Destination not found</Text></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.flag}>{flagEmoji(destination.countryCode)}</Text>
        <Text style={styles.city}>{destination.city}</Text>
        <Text style={styles.country}>{destination.country}</Text>
        {destination.description && (
          <Text style={styles.description} numberOfLines={2}>
            {destination.description}
          </Text>
        )}
      </View>

      {/* Services */}
      <ScrollView contentContainerStyle={styles.services} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>What are you looking for?</Text>
        {SERVICES.map((service) => (
          <Pressable
            key={service.key}
            style={[styles.serviceCard, { backgroundColor: service.color, borderLeftColor: service.border }]}
            onPress={() => {
              if (service.key === 'restaurants') {
                router.push(`/restaurants/${id}`);
              } else if (service.key === 'chat') {
                router.push(`/chat/${id}`);
              } else if (service.key === 'minyans') {
                router.push(`/minyans/${id}`);
              } else if (service.key === 'hosting') {
                router.push(`/hosting/${id}`);
              }
            }}
          >
            <Text style={styles.serviceIcon}>{service.icon}</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceLabel}>{service.label}</Text>
              {!['restaurants', 'chat', 'minyans', 'hosting'].includes(service.key) && (
                <Text style={styles.comingSoon}>Coming soon</Text>
              )}
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1a3a6b',
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', top: 60, left: 20 },
  backText: { fontSize: 24, color: '#fff' },
  flag: { fontSize: 52, marginBottom: 8 },
  city: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 2 },
  country: { fontSize: 14, color: '#a8c4e8', marginBottom: 10 },
  description: { fontSize: 13, color: '#c8d8ee', textAlign: 'center', lineHeight: 18 },
  services: { padding: 16, gap: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
    marginLeft: 2,
  },
  serviceCard: {
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  serviceIcon: { fontSize: 28, marginRight: 14 },
  serviceInfo: { flex: 1 },
  serviceLabel: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  comingSoon: { fontSize: 12, color: '#999', marginTop: 2 },
  arrow: { fontSize: 22, color: '#bbb' },
});
