import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import HomeButton from '@/src/components/HomeButton';

interface MyMinyan {
  id: number;
  prayerType: string;
  date: string;
  time: string;
  locationText: string;
  participantsCount: number;
  almostFull: boolean;
  isFull: boolean;
  isCreator: boolean;
  destination: { id: number; city: string } | null;
  creator: { id: number; firstName: string; lastName: string } | null;
}

const PRAYER_EMOJI: Record<string, string> = {
  shacharit: '🌅', mincha: '🌤️', maariv: '🌙', musaf: '✨', other: '🙏',
};

function formatDate(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const today = new Date().toISOString().split('T')[0];

export default function MyMinyansScreen() {
  const { t } = useTranslation();
  const PRAYER_LABEL: Record<string, string> = {
    shacharit: t('minyans.shacharit'), mincha: t('minyans.mincha'),
    maariv: t('minyans.maariv'), musaf: t('minyans.musaf'), other: t('minyans.other'),
  };
  const [minyans, setMinyans]     = useState<MyMinyan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(false);

  const fetch = async () => {
    try {
      setError(false);
      const res = await client.get('/minyans/mine');
      setMinyans(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const upcoming = minyans.filter((m) => m.date >= today);
  const past     = minyans.filter((m) => m.date < today);

  const renderItem = ({ item, isPast }: { item: MyMinyan; isPast?: boolean }) => (
    <Pressable
      style={[styles.card, isPast && styles.cardPast]}
      onPress={() => router.push(`/minyan/${item.id}`)}
    >
      <Text style={styles.cardEmoji}>{PRAYER_EMOJI[item.prayerType] ?? '🙏'}</Text>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardPrayer}>{PRAYER_LABEL[item.prayerType]}</Text>
          {item.isCreator && (
            <View style={styles.creatorBadge}><Text style={styles.creatorBadgeText}>⭐ {t('minyans.creator')}</Text></View>
          )}
          {item.isFull && !item.isCreator && (
            <View style={[styles.badge, { backgroundColor: '#4caf50' }]}><Text style={styles.badgeText}>{t('minyans.full')}</Text></View>
          )}
          {item.almostFull && !item.isFull && (
            <View style={[styles.badge, { backgroundColor: '#ff9800' }]}><Text style={styles.badgeText}>{t('minyans.almostFull')}</Text></View>
          )}
        </View>
        <Text style={styles.cardDate}>{formatDate(item.date)} • {item.time}</Text>
        <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.locationText}</Text>
        <Text style={styles.cardCount}>👥 {item.participantsCount} / 10{item.destination ? `  •  ${item.destination.city}` : ''}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.headerTitle}>🤝 {t('minyans.title')}</Text>
        <Text style={styles.headerSub}>{minyans.length} {t('minyans.title').toLowerCase()}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>{t('minyans.couldNotLoad')}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); fetch(); }}>
            <Text style={styles.retryText}>{t('minyans.tryAgain')}</Text>
          </Pressable>
        </View>
      ) : minyans.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🤝</Text>
          <Text style={styles.emptyText}>{t('minyans.noMinyansYet')}</Text>
        </View>
      ) : (
        <FlatList
          data={[...upcoming, ...past]}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }}
              colors={['#1a3a6b']} tintColor="#1a3a6b" />
          }
          ListHeaderComponent={
            upcoming.length > 0 && past.length > 0 ? (
              <Text style={styles.sectionHeader}>{t('minyans.upcomingSection')} ({upcoming.length})</Text>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isPast = item.date < today;
            const isFirstPast = isPast && (index === 0 || minyans[index - 1]?.date >= today);
            return (
              <>
                {isFirstPast && (
                  <Text style={styles.sectionHeader}>{t('minyans.pastSection')} ({past.length})</Text>
                )}
                {renderItem({ item, isPast })}
              </>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f0f4ff' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  header:          { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn:         { marginBottom: 8 },
  backText:        { fontSize: 24, color: '#fff' },
  headerTitle:     { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub:       { fontSize: 13, color: '#a8c4e8', marginTop: 2 },
  list:            { padding: 16, gap: 10 },
  sectionHeader:   { fontSize: 12, fontWeight: '700', color: '#8A96B0', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardPast:        { opacity: 0.55 },
  cardEmoji:       { fontSize: 30, marginRight: 14 },
  cardBody:        { flex: 1, gap: 3 },
  cardTop:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardPrayer:      { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  creatorBadge:    { backgroundColor: '#FFF3E0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  creatorBadgeText:{ fontSize: 11, color: '#E65100', fontWeight: '600' },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:       { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardDate:        { fontSize: 13, color: '#555' },
  cardLocation:    { fontSize: 13, color: '#777' },
  cardCount:       { fontSize: 13, color: '#1a3a6b', fontWeight: '600' },
  arrow:           { fontSize: 22, color: '#bbb', marginLeft: 8 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  retryBtn:        { backgroundColor: '#1a3a6b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
});
