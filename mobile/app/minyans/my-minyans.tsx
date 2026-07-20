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
import {
  AlertTriangle, ArrowLeft, Crown, MapPin, Users,
} from 'lucide-react-native';
import client from '@/src/api/client';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import HomeButton from '@/src/components/HomeButton';
import { getPrayerConfig } from '@/src/utils/prayerIcons';
import { C } from '@/constants/theme';

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

function formatDate(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const today = new Date().toISOString().split('T')[0];

function MyMinyansScreen() {
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

  const renderItem = ({ item, isPast }: { item: MyMinyan; isPast?: boolean }) => {
    const cfg = getPrayerConfig(item.prayerType);
    return (
      <Pressable
        style={[styles.card, isPast && styles.cardPast]}
        onPress={() => router.push(`/minyan/${item.id}`)}
      >
        <View style={[styles.cardIconBox, { backgroundColor: cfg.bg }]}>
          <cfg.Icon size={22} color={cfg.color} strokeWidth={2} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardPrayer}>{PRAYER_LABEL[item.prayerType]}</Text>
            {item.isCreator && (
              <View style={styles.creatorBadge}>
                <Crown size={11} color={C.goldMuted} strokeWidth={2} />
                <Text style={styles.creatorBadgeText}>{t('minyans.creator')}</Text>
              </View>
            )}
            {item.isFull && !item.isCreator && (
              <View style={[styles.badge, styles.fullBadge]}><Text style={[styles.badgeText, styles.fullBadgeText]}>{t('minyans.full')}</Text></View>
            )}
            {item.almostFull && !item.isFull && (
              <View style={[styles.badge, styles.almostBadge]}><Text style={[styles.badgeText, styles.almostBadgeText]}>{t('minyans.almostFull')}</Text></View>
            )}
          </View>
          <Text style={styles.cardDate}>{formatDate(item.date)} • {item.time}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
            <Text style={[styles.cardLocation, { flex: 1 }]} numberOfLines={1}>{item.locationText}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Users size={12} color={C.navy} strokeWidth={2} />
            <Text style={styles.cardCount}>{item.participantsCount} / 10{item.destination ? `  •  ${item.destination.city}` : ''}</Text>
          </View>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={C.navy} strokeWidth={2.5} />
        </Pressable>
        <HomeButton />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Users size={20} color={C.goldMuted} strokeWidth={2} />
          <Text style={styles.headerTitle}>{t('minyans.title')}</Text>
        </View>
        <Text style={styles.headerSub}>{minyans.length} {t('minyans.title').toLowerCase()}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : error ? (
        <View style={styles.center}>
          <AlertTriangle size={48} color="#F59E0B" strokeWidth={1.5} />
          <Text style={styles.emptyText}>{t('minyans.couldNotLoad')}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); fetch(); }}>
            <Text style={styles.retryText}>{t('minyans.tryAgain')}</Text>
          </Pressable>
        </View>
      ) : minyans.length === 0 ? (
        <View style={styles.center}>
          <Users size={48} color="#E5E7EB" strokeWidth={1.5} />
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
              colors={[C.navy]} tintColor={C.navy} />
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

export default withProtectedRoute(MyMinyansScreen, 'account');

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, gap: 12 },
  header:          { backgroundColor: C.cream, paddingTop: 60, paddingBottom: 22, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.goldBorder },
  backBtn:         {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle:     { fontFamily: 'Inter-Black', fontSize: 24, color: C.navy },
  headerSub:       { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary, marginTop: 2 },
  list:            { padding: 16, gap: 10 },
  sectionHeader:   { fontFamily: 'Inter-Bold', fontSize: 12, color: C.goldEyebrow, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  card:            { backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(11,23,54,0.08)', shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardPast:        { opacity: 0.55 },
  cardIconBox:     { width: 46, height: 46, borderRadius: 12, marginRight: 14, justifyContent: 'center', alignItems: 'center' },
  cardBody:        { flex: 1, gap: 3 },
  cardTop:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardPrayer:      { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  creatorBadge:    { backgroundColor: C.kashrutGoldBg, borderWidth: 1, borderColor: C.goldBorder, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  creatorBadgeText:{ fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.goldMuted },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fullBadge:       { backgroundColor: C.typeParveBg, borderWidth: 1, borderColor: 'rgba(107,142,107,0.24)' },
  almostBadge:     { backgroundColor: C.kashrutGoldBg, borderWidth: 1, borderColor: C.goldBorder },
  badgeText:       { fontFamily: 'Inter-SemiBold', fontSize: 11 },
  fullBadgeText:   { color: C.typeParve },
  almostBadgeText: { color: C.goldMuted },
  cardDate:        { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },
  cardLocation:    { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },
  cardCount:       { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.navy },
  arrow:           { fontSize: 22, color: C.textMuted, marginLeft: 8 },
  emptyText:       { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 32 },
  retryBtn:        { backgroundColor: C.navy, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText:       { color: '#fff', fontFamily: 'Inter-Bold', fontWeight: '700', fontSize: 15 },
});
