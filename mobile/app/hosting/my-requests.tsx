import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Calendar, ChevronRight, MessageCircle, Users } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface HostingRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  specialRequests?: string;
  destination: { id: number; city: string } | null;
  guest: { id: number; firstName: string; lastName?: string; email?: string } | null;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#D97706', bg: '#FFFBEB' },
  approved:  { label: 'Approved',  color: '#16A34A', bg: '#F0FDF4' },
  rejected:  { label: 'Declined',  color: '#DC2626', bg: '#FFF5F5' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6' },
};

export default function MyRequestsScreen() {
  const [tab, setTab]           = useState<'sent' | 'received'>('sent');
  const [requests, setRequests] = useState<HostingRequest[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = async (t: 'sent' | 'received') => {
    try {
      setLoading(true);
      const endpoint = t === 'sent' ? '/hosting/requests/mine' : '/hosting/requests/received';
      const res = await client.get(endpoint);
      setRequests(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await client.post(`/hosting/requests/${id}/${action}`);
      load(tab);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Action failed');
    }
  };

  const handleCancel = (id: number) => {
    Alert.alert('Cancel Request', 'Cancel this hosting arrangement? Both parties will see it as cancelled.', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Cancel Arrangement', style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/hosting/requests/${id}/cancel`);
            load(tab);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to cancel');
          }
        },
      },
    ]);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Remove from list', 'Remove this request from your view?', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/requests/${id}`);
            load(tab);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to remove');
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
          <Text style={s.headerTitle}>Requests</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['sent', 'received'] as const).map(t => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'sent' ? 'Sent' : 'Received'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const st = STATUS[item.status] ?? STATUS.pending;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardCity}>{item.destination?.city ?? '—'}</Text>
                  <View style={[s.statusPill, { backgroundColor: st.bg }]}>
                    <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
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

                {/* Guest contact — shown to host after approval */}
                {tab === 'received' && item.guest && (
                  <View style={s.guestBox}>
                    <Text style={s.guestName}>
                      {item.guest.firstName}{item.guest.lastName ? ` ${item.guest.lastName}` : ''}
                    </Text>
                    {item.guest.email
                      ? <Text style={s.guestEmail}>{item.guest.email}</Text>
                      : <Text style={s.guestHidden}>Contact revealed after approval</Text>
                    }
                  </View>
                )}

                {item.specialRequests
                  ? <Text style={s.notes}>{item.specialRequests}</Text>
                  : null}

                {/* Chat button — approved only */}
                {item.status === 'approved' && (
                  <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/hosting/chat/${item.id}` as any)}>
                    <MessageCircle size={16} color="#fff" strokeWidth={2} />
                    <Text style={s.chatBtnText}>Open Private Chat</Text>
                  </TouchableOpacity>
                )}

                {/* Approve / Reject — host, pending only */}
                {tab === 'received' && item.status === 'pending' && (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.approveBtn} onPress={() => handleAction(item.id, 'approve')}>
                      <Text style={s.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.rejectBtn} onPress={() => handleAction(item.id, 'reject')}>
                      <Text style={s.rejectBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Guest actions */}
                {tab === 'sent' && item.status === 'approved' && (
                  <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(item.id)}>
                    <Text style={s.cancelBtnText}>Cancel Arrangement</Text>
                  </TouchableOpacity>
                )}
                {tab === 'sent' && item.status !== 'approved' && (
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Text style={s.deleteBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}

                {/* Host actions — cancel approved, remove cancelled/rejected */}
                {tab === 'received' && item.status === 'approved' && (
                  <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(item.id)}>
                    <Text style={s.cancelBtnText}>Cancel Arrangement</Text>
                  </TouchableOpacity>
                )}
                {tab === 'received' && (item.status === 'cancelled' || item.status === 'rejected') && (
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Text style={s.deleteBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <MessageCircle size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>
                {tab === 'sent' ? 'No requests sent yet' : 'No requests received yet'}
              </Text>
              <Text style={s.emptySub}>
                {tab === 'sent' ? 'Find a host to get started' : 'Your hosting offers will appear here'}
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

  tabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: C.navy },
  tabText:      { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.textMuted },
  tabTextActive:{ color: C.navy },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardCity:   { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: 12 },

  row:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  meta: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },

  guestBox:   { backgroundColor: C.surface, borderRadius: 10, padding: 10, marginTop: 8 },
  guestName:  { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.textPrimary },
  guestEmail: { fontFamily: 'Inter-Regular',  fontSize: 13, color: C.textSecondary, marginTop: 2 },
  guestHidden:{ fontFamily: 'Inter-Regular',  fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 2 },

  notes: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 8 },

  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, backgroundColor: C.navy, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'flex-start',
  },
  chatBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },

  actions:    { flexDirection: 'row', gap: 10, marginTop: 12 },
  approveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' },
  rejectBtn:  { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center' },
  approveBtnText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#16A34A' },
  rejectBtnText:  { fontFamily: 'Inter-Bold', fontSize: 14, color: C.error },

  cancelBtn: {
    marginTop: 12, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF5F5',
  },
  cancelBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#DC2626' },

  deleteBtn: {
    marginTop: 12, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  deleteBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#6B7280' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
  emptySub:   { fontFamily: 'Inter-Regular',  fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
