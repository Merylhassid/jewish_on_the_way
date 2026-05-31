import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface Place {
  id: number; name: string; address?: string;
  lat?: number; lng?: number; type: 'restaurant' | 'synagogue';
  kashrutLevel?: string; restaurantType?: string;
}

const KASHRUT_COLOR: Record<string, string> = {
  rabbinate: '#6B7280', mehadrin: '#2563EB', badatz: '#059669',
};

type LayerFilter = 'all' | 'restaurants' | 'synagogues';

export default function MapScreen() {
  const { destinationId, lat, lng, name } = useLocalSearchParams<{
    destinationId: string; lat?: string; lng?: string; name?: string;
  }>();

  const [places,  setPlaces]  = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [layer,   setLayer]   = useState<LayerFilter>('all');
  const mapRef = useRef<MapView>(null);

  const centerLat = lat ? parseFloat(lat) : 31.7767;
  const centerLng = lng ? parseFloat(lng) : 35.2345;

  useEffect(() => {
    (async () => {
      const [rRes, sRes] = await Promise.allSettled([
        client.get('/restaurants', { params: { destinationId } }),
        client.get('/synagogues',  { params: { destinationId } }),
      ]);
      const all: Place[] = [];
      if (rRes.status === 'fulfilled') {
        rRes.value.data
          .filter((r: any) => r.lat && r.lng)
          .forEach((r: any) => all.push({
            id: r.id, name: r.name, address: r.address, type: 'restaurant',
            lat: r.lat, lng: r.lng, kashrutLevel: r.kashrutLevel, restaurantType: r.restaurantType,
          }));
      }
      if (sRes.status === 'fulfilled') {
        sRes.value.data
          .filter((s: any) => s.location?.coordinates)
          .forEach((s: any) => {
            const [sLng, sLat] = s.location.coordinates;
            all.push({ id: s.id, name: s.name, address: s.address, type: 'synagogue', lat: sLat, lng: sLng });
          });
      }
      setPlaces(all);
      setLoading(false);
    })();
  }, [destinationId]);

  const visible = places.filter(p =>
    layer === 'all' ? true :
    layer === 'restaurants' ? p.type === 'restaurant' :
    p.type === 'synagogue',
  );

  const initialRegion: Region = {
    latitude: centerLat, longitude: centerLng,
    latitudeDelta: 0.08, longitudeDelta: 0.08,
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{name ?? 'Map'}</Text>
        <Text style={s.headerCount}>{visible.length} places</Text>
      </View>

      {/* Layer filters */}
      <View style={s.filters}>
        {(['all', 'restaurants', 'synagogues'] as LayerFilter[]).map(f => (
          <Pressable
            key={f}
            style={[s.chip, layer === f && s.chipActive]}
            onPress={() => setLayer(f)}
          >
            <Text style={[s.chipText, layer === f && s.chipTextActive]}>
              {f === 'all' ? 'All' : f === 'restaurants' ? '🍽️ Restaurants' : '🕍 Synagogues'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={s.map}
          initialRegion={initialRegion}
          showsUserLocation
        >
          {visible.map(p => (
            <Marker
              key={`${p.type}-${p.id}`}
              coordinate={{ latitude: p.lat!, longitude: p.lng! }}
              pinColor={p.type === 'synagogue' ? '#7C3AED' : (KASHRUT_COLOR[p.kashrutLevel ?? ''] ?? C.gold)}
            >
              <Callout onPress={() => router.push(`/${p.type}/${p.id}` as any)}>
                <View style={s.callout}>
                  <Text style={s.calloutName}>{p.name}</Text>
                  {p.address && <Text style={s.calloutAddr} numberOfLines={1}>{p.address}</Text>}
                  <Text style={s.calloutTap}>Tap to open →</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.navy, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },
  headerCount: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  filters: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5DCC8',
  },
  chip: {
    borderWidth: 1.5, borderColor: '#D1C4A0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  chipActive:     { borderColor: C.navy, backgroundColor: 'rgba(10,35,66,0.08)' },
  chipText:       { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: C.navy, fontWeight: '800' },

  map: { flex: 1 },

  callout: { width: 200, padding: 4 },
  calloutName: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  calloutAddr: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  calloutTap:  { fontSize: 11, color: C.navy, fontWeight: '600' },
});
