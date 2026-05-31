import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  lat: number; lng: number;
}

function parseWKB(hex: any): { lat: number; lng: number } | null {
  if (!hex || typeof hex !== 'string' || hex.length < 42) return null;
  try {
    const pairs = hex.match(/.{2}/g);
    if (!pairs) return null;
    const bytes = new Uint8Array(pairs.map((b: string) => parseInt(b, 16)));
    const view = new DataView(bytes.buffer);
    const le = bytes[0] === 1;
    const geomType = view.getUint32(1, le);
    let offset = 5;
    if (geomType & 0x20000000) offset += 4;
    const x = view.getFloat64(offset, le);
    const y = view.getFloat64(offset + 8, le);
    if (!isFinite(x) || !isFinite(y)) return null;
    return { lat: y, lng: x };
  } catch { return null; }
}

async function nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'JewishOnTheWay/1.0' } },
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function buildLeafletHtml(places: Place[], cLat: number, cLng: number) {
  const markersJs = places.map(p =>
    `addM(${p.lat},${p.lng},${JSON.stringify(p.name)},${JSON.stringify(p.address ?? '')});`
  ).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100vh;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map').setView([${cLat},${cLng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'©OpenStreetMap'}).addTo(map);
function addM(lat,lng,name,addr){
  L.circleMarker([lat,lng],{radius:8,color:'#7C3AED',fillColor:'#7C3AED',fillOpacity:.85,weight:2})
   .bindPopup('<b>'+name+'</b><br><small>'+addr+'</small>').addTo(map);
}
${markersJs}
</script></body></html>`;
}

export default function MapScreen() {
  const { destinationId, name } = useLocalSearchParams<{ destinationId: string; name?: string }>();
  const webViewRef = useRef<any>(null);

  const [places,  setPlaces]  = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [html,    setHtml]    = useState('');

  useEffect(() => {
    (async () => {
      const cityName = name ? decodeURIComponent(name) : '';
      const geo  = cityName ? await nominatim(cityName) : null;
      const cLat = geo?.lat ?? 31.7767;
      const cLng = geo?.lng ?? 35.2345;

      try {
        const { data } = await client.get('/synagogues', { params: { destinationId } });
        const known: Place[] = [];

        for (const s of data) {
          let c: { lat: number; lng: number } | null = null;
          if (s.location?.coordinates) { const [ln, la] = s.location.coordinates; c = { lat: la, lng: ln }; }
          else if (typeof s.location === 'string') c = parseWKB(s.location);
          else if (s.lat && s.lng) c = { lat: +s.lat, lng: +s.lng };

          if (c && isFinite(c.lat) && isFinite(c.lng)) {
            known.push({ id: s.id, name: s.name, address: s.address, ...c });
          }
        }

        setPlaces(known);
        setHtml(buildLeafletHtml(known, cLat, cLng));
      } catch {}

      setLoading(false);
    })();
  }, [destinationId]);

  const webHtml = !loading
    ? buildLeafletHtml(places, 31.7767, 35.2345)
    : '';

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{decodeURIComponent(name ?? 'Map')}</Text>
        <Text style={s.headerCount}>{loading ? '…' : `${places.length} בתי כנסת`}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={{ flex: 1 }}>
          {/* @ts-ignore */}
          <iframe srcDoc={webHtml} style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="map" />
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={{ flex: 1 }} color={C.gold} />}
        />
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
});
