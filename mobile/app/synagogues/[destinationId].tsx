import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import client from '@/src/api/client';
import HomeButton from '@/src/components/HomeButton';
import {
  calculateHaversineDistance,
  formatDistance,
  extractCoordinates,
} from '@/src/utils/distance';

interface Synagogue {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  denomination?: string;
  location?: { coordinates: [number, number] };
  distanceMeters?: number;
}

const DENOM_DISPLAY: Record<string, { label: string; emoji: string; color: string }> = {
  ashkenaz: { label: 'אשכנז', emoji: '🎩', color: '#3949AB' },
  sfarad:   { label: 'ספרד',  emoji: '🌙', color: '#00897B' },
  chabad:   { label: 'חב"ד', emoji: '🕎', color: '#E65100' },
  teimanim: { label: 'תימן',  emoji: '🌿', color: '#558B2F' },
};

const ASHKENAZ_VALS = ['אשכנז', 'אשכנזי', 'ליטאי', 'ליטאית', 'ashkenaz', 'ashkenazi', 'orthodox'];
const SFARAD_VALS   = ['ספרד', 'ספרדי', 'ספרדית', 'עדות המזרח', 'מרוקאי', 'מרוקאית', 'הודי', 'בוכרה', 'אתיופי', 'טוניסאי', 'לובי', 'עיראקי', 'פרסי', 'sfarad', 'mizrahi'];
const CHABAD_VALS   = ['חב"ד', 'חבד', 'חסידי', 'חסידית', 'chabad', 'hasidic'];
const TEIMANIM_VALS = ['תימן', 'תימני', 'תימנית', 'שאמי', 'בלאדי', 'ירושלמי', 'teimanim', 'yemenite'];

function getDenomKey(denomination?: string | null): string | null {
  if (!denomination) return null;
  const d = denomination.toLowerCase();
  if (ASHKENAZ_VALS.some(v  => d.includes(v.toLowerCase()))) return 'ashkenaz';
  if (SFARAD_VALS.some(v    => d.includes(v.toLowerCase()))) return 'sfarad';
  if (CHABAD_VALS.some(v    => d.includes(v.toLowerCase()))) return 'chabad';
  if (TEIMANIM_VALS.some(v  => d.includes(v.toLowerCase()))) return 'teimanim';
  return null;
}

export default function SynagoguesScreen() {
  const { destinationId, denomination, city } =
    useLocalSearchParams<{ destinationId: string; denomination?: string; city?: string }>();

  const [synagogues, setSynagogues]     = useState<Synagogue[]>([]);
  const [total, setTotal]               = useState(0);
  const [offset, setOffset]             = useState(0);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(false);
  const [trigger, setTrigger]           = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const denomInfo = denomination ? DENOM_DISPLAY[denomination] : null;

  // בקשת מיקום
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch { /* silent */ }
      }
    })();
  }, []);

  // טעינת בתי כנסת (עמוד ראשון — מאפס בכל שינוי פילטר/מיקום)
  useEffect(() => {
    if (!destinationId) return;
    setOffset(0);

    const doFetch = async () => {
      try {
        setError(false);
        if (!refreshing) setLoading(true);

        const params: Record<string, string> = { destinationId, offset: '0' };
        if (denomination) params.denomination = denomination;
        if (userLocation) { params.lat = String(userLocation.lat); params.lng = String(userLocation.lng); }

        const res = await client.get('/synagogues', { params });
        const { data, total: t } = res.data;
        setSynagogues(Array.isArray(data) ? data : []);
        setTotal(t ?? 0);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    doFetch();
  }, [destinationId, denomination, userLocation, trigger]);

  // טעינת עמוד נוסף
  const loadMore = async () => {
    if (loadingMore) return;
    const nextOffset = offset + 50;
    try {
      setLoadingMore(true);
      const params: Record<string, string> = { destinationId, offset: String(nextOffset) };
      if (denomination) params.denomination = denomination;
      if (userLocation) { params.lat = String(userLocation.lat); params.lng = String(userLocation.lng); }

      const res = await client.get('/synagogues', { params });
      const { data } = res.data;
      setSynagogues((prev) => [...prev, ...(Array.isArray(data) ? data : [])]);
      setOffset(nextOffset);
    } catch { /* silent */ } finally {
      setLoadingMore(false);
    }
  };

  const handleCall    = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => {});
  const handleWebsite = (url: string)   => {
    if (!url.startsWith('http')) url = 'https://' + url;
    Linking.openURL(url).catch(() => {});
  };
  const retry      = () => setTrigger(t => t + 1);
  const onRefresh  = () => { setRefreshing(true); setTrigger(t => t + 1); };
  const clearFilter = () => router.replace(`/synagogues/${destinationId}` as any);

  const hasSomeDistance = synagogues.some((s) => s.distanceMeters !== undefined);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.headerTitle}>🕍 Synagogues{city ? ` — ${city}` : ''}</Text>
        <Text style={styles.headerSub}>
          {loading
            ? 'Loading…'
            : `${total || synagogues.length} synagogue${(total || synagogues.length) !== 1 ? 's' : ''}${total > synagogues.length ? `  •  showing ${synagogues.length}` : ''}${hasSomeDistance ? '  •  📍 sorted by distance' : ''}`}
        </Text>
      </View>

      {/* באנר נוסח — מוצג רק כשזוהה ע"י AI */}
      {denomInfo && (
        <View style={[styles.denomBanner, { backgroundColor: denomInfo.color }]}>
          <Text style={styles.denomBannerText}>
            {denomInfo.emoji}  מציג: נוסח {denomInfo.label} בלבד  •  זוהה ע&quot;י AI
          </Text>
          <Pressable onPress={clearFilter} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕ כל הנוסחים</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5E35B1" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>שגיאה בטעינת הנתונים</Text>
          <Pressable style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>🔄 נסה שוב</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={synagogues}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#5E35B1']}
              tintColor="#5E35B1"
            />
          }
          ListFooterComponent={
            synagogues.length < total ? (
              <Pressable style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator color="#5E35B1" />
                  : <Text style={styles.loadMoreText}>טען עוד ({total - synagogues.length} נותרו)</Text>}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const denomKey = getDenomKey(item.denomination);
            const d = denomKey ? DENOM_DISPLAY[denomKey] : null;

            return (
              <Pressable style={styles.card} onPress={() => router.push(`/synagogue/${item.id}`)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={styles.cardRight}>
                    {d && (
                      <View style={[styles.denomBadge, { backgroundColor: d.color }]}>
                        <Text style={styles.denomBadgeText}>{d.emoji} {d.label}</Text>
                      </View>
                    )}
                    {item.distanceMeters !== undefined && (
                      <Text style={styles.distance}>{formatDistance(item.distanceMeters)}</Text>
                    )}
                  </View>
                </View>
                {item.address && <Text style={styles.meta}>📍 {item.address}</Text>}
                <View style={styles.actions}>
                  {item.phone && (
                    <Pressable style={styles.actionBtn} onPress={() => handleCall(item.phone!)}>
                      <Text style={styles.actionText}>📞 Call</Text>
                    </Pressable>
                  )}
                  {item.website && (
                    <Pressable style={styles.actionBtn} onPress={() => handleWebsite(item.website!)}>
                      <Text style={styles.actionText}>🌐 Visit</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🕍</Text>
              <Text style={styles.emptyText}>
                {denomination
                  ? `לא נמצאו בתי כנסת נוסח ${denomInfo?.label ?? denomination}`
                  : 'No synagogues found'}
              </Text>
              {denomination && (
                <Pressable onPress={clearFilter} style={styles.retryBtn}>
                  <Text style={styles.retryText}>הצג כל הנוסחים</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f6fa' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },

  header:      { backgroundColor: '#5E35B1', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn:     { marginBottom: 10 },
  backText:    { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  denomBanner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  denomBannerText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  clearBtn:        { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  clearBtnText:    { color: '#fff', fontSize: 12, fontWeight: '600' },

  list:     { padding: 16, gap: 12 },
  card:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardName:      { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  cardRight:     { alignItems: 'flex-end', gap: 4 },
  denomBadge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  denomBadgeText:{ color: '#fff', fontSize: 11, fontWeight: '700' },
  distance:      { fontSize: 13, fontWeight: '600', color: '#5E35B1' },
  meta:          { fontSize: 13, color: '#666', marginBottom: 12 },
  actions:       { flexDirection: 'row', gap: 8 },
  actionBtn:     { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#5E35B1', borderRadius: 8 },
  actionText:    { fontSize: 12, fontWeight: '600', color: '#fff' },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#999', marginBottom: 16, textAlign: 'center' },
  retryBtn:      { backgroundColor: '#5E35B1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText:     { color: '#fff', fontWeight: '700' },
  loadMoreBtn:   { margin: 16, padding: 14, backgroundColor: '#EDE7F6', borderRadius: 12, alignItems: 'center' },
  loadMoreText:  { color: '#5E35B1', fontWeight: '700', fontSize: 15 },
});
