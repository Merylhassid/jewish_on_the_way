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
  lat?: number; lng?: number; type: 'restaurant' | 'synagogue';
  kashrutLevel?: string;
}

type LayerFilter = 'all' | 'restaurants' | 'synagogues';

function buildLeafletHtml(places: Place[], centerLat: number, centerLng: number) {
  const markers = places
    .filter(p => p.lat && p.lng)
    .map(p => {
      const color = p.type === 'synagogue' ? '#7C3AED' : '#C9A84C';
      const label = p.name.replace(/'/g, "\\'");
      const sub   = (p.address ?? '').replace(/'/g, "\\'");
      return `L.circleMarker([${p.lat},${p.lng}], {radius:8,color:'${color}',fillColor:'${color}',fillOpacity:0.85,weight:2})
        .bindPopup('<b>${label}</b><br><small>${sub}</small>')
        .addTo(map);`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100vh;}</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map').setView([${centerLat},${centerLng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap'
}).addTo(map);
${markers}
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const { destinationId, lat, lng, name } = useLocalSearchParams<{
    destinationId: string; lat?: string; lng?: string; name?: string;
  }>();

  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [loading, setLoading]     = useState(true);
  const [layer,   setLayer]       = useState<LayerFilter>('all');

  const [centerLat, setCenterLat] = useState(lat ? parseFloat(lat) : 31.7767);
  const [centerLng, setCenterLng] = useState(lng ? parseFloat(lng) : 35.2345);

  useEffect(() => {
    (async () => {
      // 1. קבל קורדינטות מרכז היעד מה-API
      let cLat = lat ? parseFloat(lat) : 31.7767;
      let cLng = lng ? parseFloat(lng) : 35.2345;
      try {
        const destRes = await client.get(`/destinations/${destinationId}`);
        if (destRes.data.lat && destRes.data.lng) {
          cLat = parseFloat(destRes.data.lat);
          cLng = parseFloat(destRes.data.lng);
          setCenterLat(cLat);
          setCenterLng(cLng);
        }
      } catch {}

      // 2. טען מסעדות ובתי כנסת לפי destinationId + קורדינטות לחישוב מרחק
      const [rRes, sRes] = await Promise.allSettled([
        client.get('/restaurants', { params: { destinationId, lat: cLat, lng: cLng } }),
        client.get('/synagogues',  { params: { destinationId } }),
      ]);
      const all: Place[] = [];

      if (rRes.status === 'fulfilled') {
        rRes.value.data.forEach((r: any) => {
          const rLat = parseFloat(r.lat);
          const rLng = parseFloat(r.lng);
          if (!isNaN(rLat) && !isNaN(rLng)) {
            all.push({ id: r.id, name: r.name, address: r.address, type: 'restaurant', lat: rLat, lng: rLng, kashrutLevel: r.kashrutLevel });
          }
        });
      }

      if (sRes.status === 'fulfilled') {
        sRes.value.data.forEach((s: any) => {
          if (s.location?.coordinates) {
            const [sLng, sLat] = s.location.coordinates;
            all.push({ id: s.id, name: s.name, address: s.address, type: 'synagogue', lat: sLat, lng: sLng });
          }
        });
      }

      setAllPlaces(all);
      setLoading(false);
    })();
  }, [destinationId]);

  const visible = allPlaces.filter(p =>
    layer === 'all' ? true :
    layer === 'restaurants' ? p.type === 'restaurant' : p.type === 'synagogue',
  );

  const html = buildLeafletHtml(visible, centerLat, centerLng);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{decodeURIComponent(name ?? 'Map')}</Text>
        <Text style={s.headerCount}>{visible.length} places</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
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
  chip:         { borderWidth: 1.5, borderColor: '#D1C4A0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive:   { borderColor: C.navy, backgroundColor: 'rgba(10,35,66,0.08)' },
  chipText:     { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: C.navy, fontWeight: '800' },
  fallbackText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
});
