import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, Home, Pencil, Users, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';

interface HostingOffer {
  id: number;
  hostingType: 'stay' | 'meals' | 'both';
  availableFrom: string;
  availableTo: string;
  maxGuests: number;
  allowsChildren: boolean;
  allowsShabbat: boolean;
  kashrutLevel: string | null;
  notes: string | null;
  isActive: boolean;
  destination: { id: number; city: string; country: string } | null;
}

function Tag({ text, color = C.kashrutGold }: { text: string; color?: string }) {
  return (
    <View style={s.tag}>
      <Text style={[s.tagText, { color }]}>{text}</Text>
    </View>
  );
}

const today = () => new Date().toISOString().split('T')[0];

function MyOffersScreen() {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<HostingOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const HOSTING_TYPE_LABEL: Record<HostingOffer['hostingType'], string> = {
    stay: t('hosting.typeStay'),
    meals: t('hosting.typeMealsOnly'),
    both: t('hosting.typeStayMeals'),
  };

  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await client.get('/hosting/offers/mine');
      setOffers(res.data);
    } catch {
      Alert.alert(t('common.error'), t('hosting.failedLoadOffers'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOffers(); }, []);

  const handleEdit = (item: HostingOffer) => {
    if (!item.destination) return;
    router.push({
      pathname: '/hosting/[destinationId]',
      params: {
        destinationId: String(item.destination.id),
        city: item.destination.city,
        mode: 'host',
        editOfferId: String(item.id),
      },
    } as any);
  };

  const handleDeactivate = (id: number) => {
    Alert.alert(t('hosting.deactivateConfirmTitle'), t('hosting.deactivateConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.deactivateBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/hosting/offers/${id}/deactivate`);
            loadOffers();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.failedDeactivate'));
          }
        },
      },
    ]);
  };

  const handleDelete = (id: number) => {
    Alert.alert(t('hosting.deleteOfferConfirmTitle'), t('hosting.deleteOfferConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.deleteBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/offers/${id}`);
            loadOffers();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.failedDeleteOffer'));
          }
        },
      },
    ]);
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color={C.navy} strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View>
          <Text style={s.eyebrow}>HOSTING</Text>
          <Text style={s.headerTitle}>{t('hosting.myOffersTitle')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isEnded = item.availableTo < today();
            return (
            <View style={[s.card, !item.isActive && s.cardInactive]}>
              <View style={s.cardTop}>
                <View style={s.cityRow}>
                  <Home size={16} color={C.gold} strokeWidth={2} />
                  <Text style={s.cardCity}>{item.destination?.city ?? '—'}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: isEnded ? C.kashrutNeutralBg : (item.isActive ? C.typeParveBg : C.kashrutNeutralBg) }]}>
                  <Text style={[s.statusText, { color: isEnded ? C.kashrutNeutral : (item.isActive ? C.typeParve : C.kashrutNeutral) }]}>
                    {isEnded ? t('hosting.statusEnded') : (item.isActive ? t('hosting.statusActive') : t('hosting.statusInactive'))}
                  </Text>
                </View>
              </View>

              <View style={s.dateRow}>
                <Calendar size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={s.dateText}>{item.availableFrom} → {item.availableTo}</Text>
              </View>

              <View style={s.dateRow}>
                <Users size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={s.dateText}>
                  {t('hosting.upToGuests')} {item.maxGuests} {item.maxGuests !== 1 ? t('hosting.guests') : t('hosting.guest')}
                </Text>
              </View>

              <View style={s.tags}>
                <Tag text={HOSTING_TYPE_LABEL[item.hostingType]} />
                {item.allowsShabbat   && <Tag text={t('hosting.shabbatTag')} color="#7A6B9D" />}
                {item.allowsChildren  && <Tag text={t('hosting.childrenOk')} color={C.typeDairy} />}
                {item.kashrutLevel    && <Tag text={item.kashrutLevel} color={C.kashrutGold} />}
              </View>

              {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}

              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => handleEdit(item)}>
                  <Pencil size={14} color={C.navy} strokeWidth={2.5} />
                  <Text style={s.editBtnText}>{t('hosting.editBtn')}</Text>
                </TouchableOpacity>
                {item.isActive && (
                  <TouchableOpacity style={s.deactivateBtn} onPress={() => handleDeactivate(item.id)}>
                    <X size={14} color={C.error} strokeWidth={2.5} />
                    <Text style={s.deactivateBtnText}>{t('hosting.deactivateBtn')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <X size={14} color="#9CA3AF" strokeWidth={2.5} />
                  <Text style={s.deleteBtnText}>{t('hosting.deleteBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Home size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>{t('hosting.noOffersTitle')}</Text>
              <Text style={s.emptySub}>{t('hosting.noOffersSub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

export default withProtectedRoute(MyOffersScreen, 'hosting');

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 22, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.goldBorder,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldEyebrow, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 30, color: C.navy },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardInactive: { opacity: 0.55 },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cityRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardCity: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },

  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: 12 },

  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dateText: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag:  { borderRadius: 8, borderWidth: 1, borderColor: C.goldBorder, backgroundColor: C.kashrutGoldBg, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },

  notes: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 8 },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: C.goldBorder,
    backgroundColor: '#fff',
  },
  editBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.navy },

  deactivateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  deactivateBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.error },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  deleteBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#6B7280' },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
  emptySub:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
