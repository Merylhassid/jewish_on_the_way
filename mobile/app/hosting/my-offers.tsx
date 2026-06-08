import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Calendar, ChevronRight, Home, Users, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface HostingOffer {
  id: number;
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

function Tag({ text, color = C.navy }: { text: string; color?: string }) {
  return (
    <View style={[s.tag, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={[s.tagText, { color }]}>{text}</Text>
    </View>
  );
}

export default function MyOffersScreen() {
  const [offers, setOffers] = useState<HostingOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await client.get('/hosting/offers/mine');
      setOffers(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOffers(); }, []);

  const handleDeactivate = (id: number) => {
    Alert.alert('Deactivate Offer', 'Are you sure you want to deactivate this offer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/hosting/offers/${id}/deactivate`);
            loadOffers();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to deactivate');
          }
        },
      },
    ]);
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color="#fff" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View>
          <Text style={s.eyebrow}>HOSTING</Text>
          <Text style={s.headerTitle}>My Offers</Text>
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
          renderItem={({ item }) => (
            <View style={[s.card, !item.isActive && s.cardInactive]}>
              <View style={s.cardTop}>
                <View style={s.cityRow}>
                  <Home size={16} color={C.gold} strokeWidth={2} />
                  <Text style={s.cardCity}>{item.destination?.city ?? '—'}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: item.isActive ? '#F0FDF4' : '#F3F4F6' }]}>
                  <Text style={[s.statusText, { color: item.isActive ? '#16A34A' : '#6B7280' }]}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              <View style={s.dateRow}>
                <Calendar size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={s.dateText}>{item.availableFrom} → {item.availableTo}</Text>
              </View>

              <View style={s.dateRow}>
                <Users size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={s.dateText}>Up to {item.maxGuests} guest{item.maxGuests !== 1 ? 's' : ''}</Text>
              </View>

              <View style={s.tags}>
                {item.allowsShabbat   && <Tag text="Shabbat" color="#7C3AED" />}
                {item.allowsChildren  && <Tag text="Children OK" color="#0891B2" />}
                {item.kashrutLevel    && <Tag text={item.kashrutLevel} color={C.gold} />}
              </View>

              {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}

              {item.isActive && (
                <TouchableOpacity style={s.deactivateBtn} onPress={() => handleDeactivate(item.id)}>
                  <X size={14} color={C.error} strokeWidth={2.5} />
                  <Text style={s.deactivateBtnText}>Deactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Home size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No offers yet</Text>
              <Text style={s.emptySub}>Create a hosting offer to start welcoming travelers</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', gap: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 26, color: '#fff', letterSpacing: -0.5 },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
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
  tag:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },

  notes: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 8 },

  deactivateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#FECACA',
    backgroundColor: '#FFF5F5', alignSelf: 'flex-start',
  },
  deactivateBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.error },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
  emptySub:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
