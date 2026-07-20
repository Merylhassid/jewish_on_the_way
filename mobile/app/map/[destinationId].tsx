import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Building2, Utensils } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface Place {
  id: number;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  type: 'restaurant' | 'synagogue';
}

function parseWKB(hex: string): { lat: number; lng: number } | null {
  if (!hex || typeof hex !== 'string' || hex.length < 42) return null;
  try {
    const pairs = hex.match(/.{2}/g);
    if (!pairs) return null;
    const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
    const view  = new DataView(bytes.buffer);
    const le    = bytes[0] === 1;
    const geomType = view.getUint32(1, le);
    let offset = 5;
    if (geomType & 0x20000000) offset += 4;
    const x = view.getFloat64(offset, le);
    const y = view.getFloat64(offset + 8, le);
    if (!isFinite(x) || !isFinite(y)) return null;
    return { lat: y, lng: x };
  } catch { return null; }
}

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'JewishOnTheWay/1.0' } },
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function extractCoords(item: any): { lat: number; lng: number } | null {
  if (item.location?.coordinates) {
    const [ln, la] = item.location.coordinates;
    return { lat: la, lng: ln };
  }
  if (typeof item.location === 'string') return parseWKB(item.location);
  if (item.lat && item.lng) return { lat: +item.lat, lng: +item.lng };
  return null;
}

export default function MapScreen() {
  const { destinationId, name } = useLocalSearchParams<{ destinationId: string; name?: string }>();

  const [places,  setPlaces]  = useState<Place[]>([]);
  const [center,  setCenter]  = useState({ lat: 31.7767, lng: 35.2345 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const cityName = name ? decodeURIComponent(name) : '';

      // Geocode city in parallel with API calls
      const [geo, rRes, sRes] = await Promise.allSettled([
        cityName ? geocodeCity(cityName) : Promise.resolve(null),
        client.get('/restaurants', { params: { destinationId } }),
        client.get('/synagogues',  { params: { destinationId } }),
      ]);

      if (geo.status === 'fulfilled' && geo.value) {
        setCenter(geo.value);
      }

      const collected: Place[] = [];

      if (rRes.status === 'fulfilled') {
        const list = Array.isArray(rRes.value.data) ? rRes.value.data : rRes.value.data?.data ?? [];
        for (const r of list) {
          const c = extractCoords(r);
          if (c) collected.push({ id: r.id, name: r.name, address: r.address, ...c, type: 'restaurant' });
        }
      }

      if (sRes.status === 'fulfilled') {
        const list = Array.isArray(sRes.value.data) ? sRes.value.data : sRes.value.data?.data ?? [];
        for (const s of list) {
          const c = extractCoords(s);
          if (c) collected.push({ id: s.id, name: s.name, address: s.address, ...c, type: 'synagogue' });
        }
      }

      setPlaces(collected);
      setLoading(false);
    })();
  }, [destinationId]);

  const cityName = name ? decodeURIComponent(name) : 'Map';
  const rCount   = places.filter(p => p.type === 'restaurant').length;
  const sCount   = places.filter(p => p.type === 'synagogue').length;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.navy} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{cityName}</Text>
          {!loading && (
            <Text style={s.headerSub}>
              {rCount} restaurants · {sCount} synagogues
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={s.loadingText}>Loading map…</Text>
        </View>
      ) : (
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude:       center.lat,
            longitude:      center.lng,
            latitudeDelta:  0.06,
            longitudeDelta: 0.06,
          }}
          showsUserLocation
          showsMyLocationButton
        >
          {places.map(p => (
            <Marker
              key={`${p.type}-${p.id}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              pinColor={p.type === 'restaurant' ? C.typeMeat : '#7A6B9D'}
            >
              <Callout>
                <View style={s.callout}>
                  <Text style={s.calloutTitle}>{p.name}</Text>
                  {p.address ? <Text style={s.calloutSub}>{p.address}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {p.type === 'restaurant'
                      ? <Utensils size={12} color={C.typeMeat} strokeWidth={2} />
                      : <Building2 size={12} color="#7A6B9D" strokeWidth={2} />}
                    <Text style={[s.calloutType, { color: p.type === 'restaurant' ? C.typeMeat : '#7A6B9D' }]}>
                      {p.type === 'restaurant' ? 'Restaurant' : 'Synagogue'}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Legend */}
      {!loading && (
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: C.typeMeat }]} />
            <Text style={s.legendText}>Restaurants</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: '#7A6B9D' }]} />
            <Text style={s.legendText}>Synagogues</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16, paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.goldBorder,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 20, color: C.navy },
  headerSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textSecondary, marginTop: 2 },

  callout: { minWidth: 160, padding: 4 },
  calloutTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: C.textPrimary, marginBottom: 2 },
  calloutSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted },
  calloutType:  { fontFamily: 'Inter-SemiBold', fontSize: 11, marginTop: 4 },

  legend: {
    flexDirection: 'row', gap: 20, justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: C.goldBorder,
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textSecondary },
});
