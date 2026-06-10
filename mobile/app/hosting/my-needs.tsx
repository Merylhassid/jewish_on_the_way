import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Calendar, ChevronRight, Users, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface HostingNeed {
  id: number;
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  notes?: string;
  isOpen: boolean;
  destination: { id: number; city: string } | null;
}

export default function MyNeedsScreen() {
  const [needs, setNeeds] = useState<HostingNeed[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await client.get('/hosting/needs/mine');
      setNeeds(Array.isArray(res.data) ? res.data : []);
    } catch {
      Alert.alert('Error', 'Failed to load posted needs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClose = async (id: number) => {
    Alert.alert(
      'Close Request',
      'Mark this need as closed? It will no longer appear to hosts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.patch(`/hosting/needs/${id}/close`);
              load();
            } catch {
              Alert.alert('Error', 'Could not close this need');
            }
          },
        },
      ],
    );
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Need', 'Permanently delete this posted need?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/needs/${id}`);
            load();
          } catch {
            Alert.alert('Error', 'Could not delete this need');
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
          <Text style={s.headerTitle}>My Posted Needs</Text>
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
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardCity}>{item.destination?.city ?? '—'}</Text>
                <View style={[s.statusPill, item.isOpen ? s.pillOpen : s.pillClosed]}>
                  <Text style={[s.statusText, { color: item.isOpen ? '#16A34A' : '#6B7280' }]}>
                    {item.isOpen ? 'Open' : 'Closed'}
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
                  {item.guestsCount} guest{item.guestsCount !== 1 ? 's' : ''}
                  {item.forShabbat ? ' · Shabbat' : ''}
                  {item.withChildren ? ' · Children' : ''}
                </Text>
              </View>

              {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}

              <View style={s.cardActions}>
                {item.isOpen && (
                  <TouchableOpacity style={s.closeBtn} onPress={() => handleClose(item.id)}>
                    <X size={14} color="#DC2626" strokeWidth={2.5} />
                    <Text style={s.closeBtnText}>Close Request</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <X size={14} color="#9CA3AF" strokeWidth={2.5} />
                  <Text style={s.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Users size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No posted needs yet</Text>
              <Text style={s.emptySub}>
                When you post a request for hosting, it will appear here.
              </Text>
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
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardCity:   { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillOpen:   { backgroundColor: '#F0FDF4' },
  pillClosed: { backgroundColor: '#F3F4F6' },
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
