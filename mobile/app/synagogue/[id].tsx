import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
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
  denomination?: string;
  openingHours?: string;
  operator?: string;
  location?: { coordinates: [number, number] };
}

export default function SynagogueDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [synagogue, setSynagogue] = useState<Synagogue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSynagogue = async () => {
      try {
        setLoading(true);
        const res = await client.get(`/synagogues/${id}`);
        setSynagogue(res.data);
      } catch (error) {
        // silent
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSynagogue();
    }
  }, [id]);

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

  const handleMaps = (coords: [number, number]) => {
    const [lng, lat] = coords;
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      // silent
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🕍 Synagogue</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5E35B1" />
        </View>
      </View>
    );
  }

  if (!synagogue) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🕍 Synagogue</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.notFound}>Synagogue not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🕍 Synagogue</Text>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Text style={styles.name}>{synagogue.name}</Text>

        {/* Denomination */}
        {synagogue.denomination && (
          <View style={styles.denominationBadge}>
            <Text style={styles.denominationText}>{synagogue.denomination}</Text>
          </View>
        )}

        {/* Address */}
        {synagogue.address && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📍 Address</Text>
            <Text style={styles.sectionValue}>{synagogue.address}</Text>
          </View>
        )}

        {/* Operator */}
        {synagogue.operator && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🏢 Operator</Text>
            <Text style={styles.sectionValue}>{synagogue.operator}</Text>
          </View>
        )}

        {/* Opening Hours */}
        {synagogue.openingHours && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🕐 Hours</Text>
            <Text style={styles.sectionValue}>{synagogue.openingHours}</Text>
          </View>
        )}

        {/* Contact Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Contact</Text>
          <View style={styles.actions}>
            {synagogue.phone && (
              <Pressable
                style={styles.actionBtnLarge}
                onPress={() => handleCall(synagogue.phone!)}
              >
                <Text style={styles.actionIcon}>📞</Text>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Call</Text>
                  <Text style={styles.actionValue}>{synagogue.phone}</Text>
                </View>
              </Pressable>
            )}
            {synagogue.website && (
              <Pressable
                style={styles.actionBtnLarge}
                onPress={() => handleWebsite(synagogue.website!)}
              >
                <Text style={styles.actionIcon}>🌐</Text>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Visit Website</Text>
                  <Text style={styles.actionValue} numberOfLines={1}>
                    {synagogue.website}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* Location / Map */}
        {synagogue.location && (
          <View style={styles.section}>
            <Pressable
              style={styles.mapButton}
              onPress={() => handleMaps(synagogue.location!.coordinates)}
            >
              <Text style={styles.mapButtonIcon}>🗺️</Text>
              <Text style={styles.mapButtonText}>View on Map</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f6fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 15, color: '#999' },

  header: {
    backgroundColor: '#5E35B1',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },

  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },

  name: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  denominationBadge: {
    backgroundColor: '#5E35B1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  denominationText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A96B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionValue: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },

  actions: { gap: 12 },
  actionBtnLarge: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionIcon: { fontSize: 24, marginRight: 12 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 13, fontWeight: '600', color: '#5E35B1' },
  actionValue: { fontSize: 12, color: '#666', marginTop: 2 },

  mapButton: {
    flexDirection: 'row',
    backgroundColor: '#5E35B1',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapButtonIcon: { fontSize: 20 },
  mapButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
