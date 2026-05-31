import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '@/src/api/client';
import HomeButton from '@/src/components/HomeButton';

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
  { key: 'restaurants', icon: '🍽️', label: 'Kosher Restaurants', iconBg: '#E8F5E9', iconColor: '#388E3C' },
  { key: 'synagogues',  icon: '🕍',  label: 'Synagogues',         iconBg: '#EDE7F6', iconColor: '#5E35B1' },
  { key: 'minyans',     icon: '🤝',  label: 'Minyans',            iconBg: '#FFF3E0', iconColor: '#E65100' },
  { key: 'hosting',     icon: '🏠',  label: 'Shabbat Hosting',    iconBg: '#FCE4EC', iconColor: '#C2185B' },
  { key: 'chat',        icon: '💬',  label: 'Traveler Chat',      iconBg: '#E0F7FA', iconColor: '#00838F' },
];

const ACTIVE_KEYS = ['restaurants', 'synagogues', 'chat', 'minyans', 'hosting'];

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);

  // ── חיפוש חכם ──────────────────────────────────────────────
  const [searchText, setSearchText]     = useState('');
  const [searching, setSearching]       = useState(false);
  const [lastResult, setLastResult]     = useState<string | null>(null);

  // שולח את הטקסט למודל ה-AI ומנווט לדף הנכון
  const handleSmartSearch = async () => {
    if (!searchText.trim()) return;
    try {
      setSearching(true);
      setLastResult(null);
      const res = await client.post('/search', {
        text: searchText.trim(),
        destinationId: Number(id),
      });
      const { route, category, emoji } = res.data;
      setLastResult(`${emoji} ${category}`);
      router.push(route as any);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לחפש כרגע, נסה שוב');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    client.get(`/destinations/${id}`)
      .then((res) => setDestination(res.data))
      .catch(() => {
        AsyncStorage.removeItem('lastDestinationId');
        router.replace('/(tabs)');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0C2461" /></View>;
  }

  if (!destination) {
    return <View style={styles.center}><Text style={styles.notFound}>Destination not found</Text></View>;
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.flag}>{flagEmoji(destination.countryCode)}</Text>
        <Text style={styles.city}>{destination.city}</Text>
        <View style={styles.countryBadge}>
          <Text style={styles.countryText}>{destination.country}</Text>
        </View>
        {destination.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {destination.description}
          </Text>
        ) : null}
      </View>

      {/* ── Smart Search ── */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="מה אתה מחפש? (כשר, מניין, אירוח...)"
          placeholderTextColor="#8A96B0"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSmartSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
          onPress={handleSmartSearch}
          disabled={searching || !searchText.trim()}
        >
          {searching
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.searchBtnText}>🔍</Text>
          }
        </TouchableOpacity>
      </View>
      {lastResult && (
        <View style={styles.resultHint}>
          <Text style={styles.resultHintText}>✨ המודל זיהה: {lastResult}</Text>
        </View>
      )}

      {/* ── Services ── */}
      <ScrollView contentContainerStyle={styles.services} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>What are you looking for?</Text>

        {SERVICES.map((service) => {
          const isActive = ACTIVE_KEYS.includes(service.key);
          return (
            <Pressable
              key={service.key}
              style={({ pressed }) => [
                styles.serviceCard,
                !isActive && styles.serviceCardDimmed,
                pressed && isActive && styles.serviceCardPressed,
              ]}
              onPress={() => {
                if (!isActive) return;
                const city = encodeURIComponent(destination.city);
                if (service.key === 'restaurants') router.push(`/restaurants/${id}?city=${city}`);
                else if (service.key === 'synagogues') router.push(`/synagogues/${id}?city=${city}`);
                else if (service.key === 'chat') router.push(`/chat/${id}?city=${city}`);
                else if (service.key === 'minyans') router.push(`/minyans/${id}?city=${city}`);
                else if (service.key === 'hosting') router.push(`/hosting/${id}?city=${city}`);
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: service.iconBg }]}>
                <Text style={styles.serviceIcon}>{service.icon}</Text>
              </View>
              <View style={styles.serviceInfo}>
                <Text style={[styles.serviceLabel, !isActive && styles.serviceLabelDimmed]}>
                  {service.label}
                </Text>
                {!isActive && <Text style={styles.comingSoon}>Coming soon</Text>}
              </View>
              {isActive && (
                <View style={styles.arrowBadge}>
                  <Text style={styles.arrowText}>›</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 15, color: '#8A96B0' },

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
  city: { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: 0.2 },
  countryBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
  },
  countryText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  description: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19 },

  services: { padding: 20, gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A96B0',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginLeft: 2,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0C2461',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  serviceCardDimmed: { opacity: 0.55 },
  serviceCardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  serviceIcon: { fontSize: 22 },
  serviceInfo: { flex: 1 },
  serviceLabel: { fontSize: 16, fontWeight: '700', color: '#0C1A2E' },
  serviceLabelDimmed: { color: '#8A96B0' },
  comingSoon: {
    fontSize: 11,
    color: '#B0BAC8',
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  arrowBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F2F5FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { fontSize: 18, color: '#0C2461', fontWeight: '700', lineHeight: 22 },

  // Smart Search
  searchBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, shadowColor: '#0C2461', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  searchInput:      { flex: 1, fontSize: 15, color: '#0C1A2E', paddingVertical: 10 },
  searchBtn:        { backgroundColor: '#0C2461', borderRadius: 12, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  searchBtnDisabled:{ backgroundColor: '#B0BAC8' },
  searchBtnText:    { fontSize: 18 },
  resultHint:       { marginHorizontal: 16, marginTop: 8, backgroundColor: '#EDE7F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  resultHintText:   { fontSize: 13, color: '#5E35B1', fontWeight: '600' },
});
