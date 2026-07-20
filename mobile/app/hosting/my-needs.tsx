import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, Users, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';

interface HostingNeed {
  id: number;
  hostingType: 'stay' | 'meals';
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  notes?: string;
  isOpen: boolean;
  destination: { id: number; city: string } | null;
}

const today = () => new Date().toISOString().split('T')[0];

function MyNeedsScreen() {
  const { t } = useTranslation();
  const [needs, setNeeds] = useState<HostingNeed[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await client.get('/hosting/needs/mine');
      setNeeds(Array.isArray(res.data) ? res.data : []);
    } catch {
      Alert.alert(t('common.error'), t('hosting.failedLoadNeeds'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClose = async (id: number) => {
    Alert.alert(
      t('hosting.closeRequestBtn'),
      t('hosting.closeConfirmMsg'),
      [
        { text: t('hosting.cancelBtn'), style: 'cancel' },
        {
          text: t('hosting.closeBtn'),
          style: 'destructive',
          onPress: async () => {
            try {
              await client.patch(`/hosting/needs/${id}/close`);
              load();
            } catch {
              Alert.alert(t('common.error'), t('hosting.failedCloseNeed'));
            }
          },
        },
      ],
    );
  };

  const handleDelete = (id: number) => {
    Alert.alert(t('hosting.deleteNeedConfirmTitle'), t('hosting.deleteNeedConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.deleteBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/needs/${id}`);
            load();
          } catch {
            Alert.alert(t('common.error'), t('hosting.failedDeleteNeed'));
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
          <Text style={s.headerTitle}>{t('hosting.myNeedsTitle')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={needs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isEnded = item.departureDate < today();
            return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardCity}>{item.destination?.city ?? '—'}</Text>
                <View style={[s.statusPill, (isEnded || !item.isOpen) ? s.pillClosed : s.pillOpen]}>
                  <Text style={[s.statusText, { color: (isEnded || !item.isOpen) ? C.kashrutNeutral : C.typeParve }]}>
                    {isEnded ? t('hosting.statusEnded') : (item.isOpen ? t('hosting.statusOpen') : t('hosting.statusClosed'))}
                  </Text>
                </View>
              </View>

              <View style={s.row}>
                <Calendar size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={s.meta}>{item.arrivalDate} → {item.departureDate}</Text>
              </View>
              <View style={s.row}>
                <Users size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={s.meta}>
                  {item.guestsCount} {item.guestsCount !== 1 ? t('hosting.guests') : t('hosting.guest')}
                  {' · '}{item.hostingType === 'meals' ? t('hosting.typeMealsOnly') : t('hosting.typeStay')}
                  {item.forShabbat ? ` · ${t('hosting.shabbatTag')}` : ''}
                  {item.withChildren ? ` · ${t('hosting.childrenOk')}` : ''}
                </Text>
              </View>

              {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}

              <View style={s.cardActions}>
                {item.isOpen && (
                  <TouchableOpacity style={s.closeBtn} onPress={() => handleClose(item.id)}>
                    <X size={14} color="#DC2626" strokeWidth={2.5} />
                    <Text style={s.closeBtnText}>{t('hosting.closeRequestBtn')}</Text>
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
              <Users size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>{t('hosting.noNeedsTitle')}</Text>
              <Text style={s.emptySub}>
                {t('hosting.noNeedsSub')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

export default withProtectedRoute(MyNeedsScreen, 'hosting');

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
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardCity:   { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillOpen:   { backgroundColor: C.typeParveBg },
  pillClosed: { backgroundColor: C.kashrutNeutralBg },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: 12 },

  row:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  meta: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },
  notes: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 8 },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },

  closeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFF5F5',
  },
  closeBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#DC2626' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F9FAFB',
  },
  deleteBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#6B7280' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
  emptySub:   { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
