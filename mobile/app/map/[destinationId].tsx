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
  lat: number; lng: number; type: 'restaurant' | 'synagogue';
}
type Pending = { id: number; name: string; address: string; type: 'restaurant' | 'synagogue' };
type LayerFilter = 'all' | 'restaurants' | 'synagogues';

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
    `addM(${p.lat},${p.lng},${JSON.stringify(p.type === 'synagogue' ? '#7C3AED' : '#C9A84C')},${JSON.stringify(p.name)},${JSON.stringify(p.address ?? '')},${JSON.stringify(p.type)});`
  ).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100vh;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map').setView([${cLat},${cLng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'©OpenStreetMap'}).addTo(map);
var RL=L.layerGroup().addTo(map),SL=L.layerGroup().addTo(map);
function addM(lat,lng,color,name,addr,type){
  var g=type==='synagogue'?SL:RL;
  L.circleMarker([lat,lng],{radius:8,color:color,fillColor:color,fillOpacity:.85,weight:2})
   .bindPopup('<b>'+name+'</b><br><small>'+addr+'</small>').addTo(g);
}
function showLayer(l){
  if(l==='all'){map.addLayer(RL);map.addLayer(SL);}
  else if(l==='restaurants'){map.addLayer(RL);map.removeLayer(SL);}
  else{map.removeLayer(RL);map.addLayer(SL);}
}
window.addEventListener('message',function(e){if(e.data)showLayer(e.data);});
document.addEventListener('message',function(e){if(e.data)showLayer(e.data);});
${markersJs}
</script></body></html>`;
}

export default function MapScreen() {
  const { destinationId, name } = useLocalSearchParams<{ destinationId: string; name?: string }>();
  const webViewRef  = useRef<any>(null);
  const pendingRef  = useRef<Pending[]>([]);
  const centerRef   = useRef({ lat: 31.7767, lng: 35.2345 });

  const [places,  setPlaces]  = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [html,    setHtml]    = useState('');
  const [layer,   setLayer]   = useState<LayerFilter>('all');

  // ── 1. Fetch data, show map immediately with whatever has coords ────────────
  useEffect(() => {
    (async () => {
      const cityName = name ? decodeURIComponent(name) : '';
      const geo  = cityName ? await nominatim(cityName) : null;
      const cLat = geo?.lat ?? 31.7767;
      const cLng = geo?.lng ?? 35.2345;
      centerRef.current = { lat: cLat, lng: cLng };

      const [rRes, sRes] = await Promise.allSettled([
        client.get('/restaurants', { params: { destinationId } }),
        client.get('/synagogues',  { params: { destinationId } }),
      ]);

      const known: Place[]   = [];
      const pending: Pending[] = [];

      if (rRes.status === 'fulfilled') {
        for (const r of rRes.value.data) {
          let c: { lat: number; lng: number } | null = null;
          if (r.lat && r.lng) c = { lat: +r.lat, lng: +r.lng };
          else if (r.location) c = parseWKB(r.location);
          if (c && isFinite(c.lat) && isFinite(c.lng)) {
            known.push({ id: r.id, name: r.name, address: r.address, type: 'restaurant', ...c });
          } else if (r.address) {
            pending.push({ id: r.id, name: r.name, address: r.address, type: 'restaurant' });
          }
        }
      }

      if (sRes.status === 'fulfilled') {
        for (const s of sRes.value.data) {
          let c: { lat: number; lng: number } | null = null;
          if (s.location?.coordinates) { const [ln, la] = s.location.coordinates; c = { lat: la, lng: ln }; }
          else if (typeof s.location === 'string') c = parseWKB(s.location);
          else if (s.lat && s.lng) c = { lat: +s.lat, lng: +s.lng };
          if (c && isFinite(c.lat) && isFinite(c.lng)) {
            known.push({ id: s.id, name: s.name, address: s.address, type: 'synagogue', ...c });
          } else if (s.address) {
            pending.push({ id: s.id, name: s.name, address: s.address, type: 'synagogue' });
          }
        }
      }

      pendingRef.current = pending;
      setPlaces(known);
      setHtml(buildLeafletHtml(known, cLat, cLng));
      setLoading(false);
    })();
  }, [destinationId]);

  // ── 2. After WebView loads, geocode remaining silently in background ────────
  const onMapLoad = () => {
    const batch = pendingRef.current.slice(0, 20);
    if (batch.length === 0) return;

    (async () => {
      for (let i = 0; i < batch.length; i++) {
        const p = batch[i];
        const c = await nominatim(p.address);
        if (c && isFinite(c.lat) && isFinite(c.lng)) {
          const color = p.type === 'synagogue' ? '#7C3AED' : '#C9A84C';
          webViewRef.current?.injectJavaScript(
            `addM(${c.lat},${c.lng},${JSON.stringify(color)},${JSON.stringify(p.name)},${JSON.stringify(p.address)},${JSON.stringify(p.type)}); true;`
          );
          setPlaces(prev => [...prev, { ...p, ...c }]);
        }
        if (i < batch.length - 1) await new Promise<void>(r => setTimeout(r, 1100));
      }
    })();
  };

  const changeLayer = (l: LayerFilter) => {
    setLayer(l);
    webViewRef.current?.injectJavaScript(`showLayer(${JSON.stringify(l)}); true;`);
  };

  const visible = places.filter(p =>
    layer === 'all' ? true : layer === 'restaurants' ? p.type === 'restaurant' : p.type === 'synagogue'
  );

  const webHtml = !loading
    ? buildLeafletHtml(visible, centerRef.current.lat, centerRef.current.lng)
    : '';

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
          <Pressable key={f} style={[s.chip, layer === f && s.chipActive]} onPress={() => changeLayer(f)}>
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
          <iframe key={layer} srcDoc={webHtml} style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="map" />
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          onLoad={onMapLoad}
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
  filters: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5DCC8',
  },
  chip:           { borderWidth: 1.5, borderColor: '#D1C4A0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive:     { borderColor: C.navy, backgroundColor: 'rgba(10,35,66,0.08)' },
  chipText:       { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: C.navy, fontWeight: '800' },
});
