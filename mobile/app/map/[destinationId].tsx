import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface Place {
  id: number; name: string; address?: string;
  lat: number; lng: number; type: 'restaurant' | 'synagogue';
  kashrutLevel?: string;
}

type LayerFilter = 'all' | 'restaurants' | 'synagogues';

// ── WKB parser (PostGIS hex → lat/lng) ──────────────────────────────────────
function parseWKB(hex: any): { lat: number; lng: number } | null {
  if (!hex || typeof hex !== 'string' || hex.length < 42) return null;
  try {
    const pairs = hex.match(/.{2}/g);
    if (!pairs) return null;
    const bytes = new Uint8Array(pairs.map(b => parseInt(b, 16)));
    const view = new DataView(bytes.buffer);
    const le = bytes[0] === 1;
    const geomType = view.getUint32(1, le);
    let offset = 5;
    if (geomType & 0x20000000) offset += 4; // skip SRID
    const x = view.getFloat64(offset, le);
    const y = view.getFloat64(offset + 8, le);
    if (!isFinite(x) || !isFinite(y)) return null;
    return { lat: y, lng: x };
  } catch { return null; }
}

// ── Leaflet HTML builder ─────────────────────────────────────────────────────
function buildLeafletHtml(places: Place[], centerLat: number, centerLng: number) {
  const markers = places.map(p => {
    const color = p.type === 'synagogue' ? '#7C3AED' : '#C9A84C';
    const label = p.name.replace(/['"\\]/g, ' ');
    const sub   = (p.address ?? '').replace(/['"\\]/g, ' ');
    return `L.circleMarker([${p.lat},${p.lng}],{radius:8,color:'${color}',fillColor:'${color}',fillOpacity:0.85,weight:2}).bindPopup('<b>${label}</b><br><small>${sub}</small>').addTo(map);`;
  }).join('\n');

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100vh;}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map').setView([${centerLat},${centerLng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
${markers}
</script>
</body></html>`;
}

// ── Geocode city via Nominatim ───────────────────────────────────────────────
async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(city);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'User-Agent': 'JewishOnTheWay/1.0' },
    });
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { destinationId, name } = useLocalSearchParams<{
    destinationId: string; name?: string;
  }>();

  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [center,    setCenter]    = useState<{ lat: number; lng: number } | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [layer,     setLayer]     = useState<LayerFilter>('all');

  useEffect(() => {
    (async () => {
      const cityName = name ? decodeURIComponent(name) : '';

      // 1. מרכז המפה — Nominatim לפי שם העיר
      const geo = cityName ? await geocodeCity(cityName) : null;
      const cLat = geo?.lat ?? 31.7767;
      const cLng = geo?.lng ?? 35.2345;
      setCenter({ lat: cLat, lng: cLng });

      // 2. מסעדות + בתי כנסת לפי destinationId
      const [rRes, sRes] = await Promise.allSettled([
        client.get('/restaurants', { params: { destinationId } }),
        client.get('/synagogues',  { params: { destinationId } }),
      ]);

      const all: Place[] = [];

      if (rRes.status === 'fulfilled') {
        for (const r of rRes.value.data) {
          // נסה lat/lng ישיר, אחר כך WKB
          let coords: { lat: number; lng: number } | null = null;
          if (r.lat && r.lng) {
            coords = { lat: parseFloat(r.lat), lng: parseFloat(r.lng) };
          } else if (r.location) {
            coords = parseWKB(r.location);
          }
          if (coords && isFinite(coords.lat) && isFinite(coords.lng)) {
            all.push({ id: r.id, name: r.name, address: r.address, type: 'restaurant', ...coords, kashrutLevel: r.kashrutLevel });
          }
        }
      }

      if (sRes.status === 'fulfilled') {
        for (const s of sRes.value.data) {
          let coords: { lat: number; lng: number } | null = null;
          if (s.location?.coordinates) {
            const [sLng, sLat] = s.location.coordinates;
            coords = { lat: sLat, lng: sLng };
          } else if (s.location && typeof s.location === 'string') {
            coords = parseWKB(s.location);
          } else if (s.lat && s.lng) {
            coords = { lat: parseFloat(s.lat), lng: parseFloat(s.lng) };
          }
          if (coords && isFinite(coords.lat) && isFinite(coords.lng)) {
            all.push({ id: s.id, name: s.name, address: s.address, type: 'synagogue', ...coords });
          }
        }
      }

      setAllPlaces(all);
      setLoading(false);
    })();
  }, [destinationId]);

  const visible = allPlaces.filter(p =>
    layer === 'all' ? true :
    layer === 'restaurants' ? p.type === 'restaurant' : p.type === 'synagogue',
  );

  const cLat = center?.lat ?? 31.7767;
  const cLng = center?.lng ?? 35.2345;
  const html = buildLeafletHtml(visible, cLat, cLng);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{decodeURIComponent(name ?? 'Map')}</Text>
        <Text style={s.headerCount}>{loading ? '…' : `${visible.length} places`}</Text>
      </View>

      <View style={s.filters}>
        {(['all', 'restaurants', 'synagogues'] as LayerFilter[]).map(f => (
          <Pressable key={f} style={[s.chip, layer === f && s.chipActive]} onPress={() => setLayer(f)}>
            <Text style={[s.chipText, layer === f && s.chipTextActive]}>
              {f === 'all' ? 'All' : f === 'restaurants' ? '🍽️ Restaurants' : '🕍 Synagogues'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={{ color: C.textMuted, fontSize: 13 }}>Loading map…</Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={{ flex: 1 }}>
          {/* @ts-ignore */}
          <iframe srcDoc={html} style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="map" />
        </View>
      ) : (
        <WebView source={{ html }} style={{ flex: 1 }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
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
  chip:           { borderWidth: 1.5, borderColor: '#D1C4A0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive:     { borderColor: C.navy, backgroundColor: 'rgba(10,35,66,0.08)' },
  chipText:       { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: C.navy, fontWeight: '800' },
});
