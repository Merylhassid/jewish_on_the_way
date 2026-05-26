import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '@/src/api/client';
import HomeButton from '@/src/components/HomeButton';

interface HostingRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  specialRequests?: string;
  destination: { id: number; city: string } | null;
  guest: { id: number; firstName: string; lastName?: string; email?: string } | null;
}

const STATUS_COLOR = { pending: '#ff9800', approved: '#4caf50', rejected: '#f44336' };
const STATUS_LABEL = { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' };

export default function MyRequestsScreen() {
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [requests, setRequests] = useState<HostingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async (t: 'sent' | 'received') => {
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

  useEffect(() => { fetch(tab); }, [tab]);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await client.post(`/hosting/requests/${id}/${action}`);
      fetch(tab);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Action failed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.headerTitle}>🏠 Hosting Requests</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'sent' && styles.tabActive]} onPress={() => setTab('sent')}>
          <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Sent</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'received' && styles.tabActive]} onPress={() => setTab('received')}>
          <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>Received</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardCity}>📍 {item.destination?.city ?? '—'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>

              <Text style={styles.cardDates}>
                📅 {item.arrivalDate} → {item.departureDate}
              </Text>
              <Text style={styles.cardMeta}>
                👥 {item.guestsCount} guest{item.guestsCount !== 1 ? 's' : ''}
                {item.forShabbat ? '  •  🕍 Shabbat' : ''}
                {item.withChildren ? '  •  👨‍👩‍👧 Children' : ''}
              </Text>

              {/* Show guest contact only when approved (host view) */}
              {tab === 'received' && item.guest && (
                <View style={styles.guestInfo}>
                  <Text style={styles.guestName}>
                    Guest: {item.guest.firstName}
                    {item.guest.lastName ? ` ${item.guest.lastName}` : ''}
                  </Text>
                  {item.guest.email && (
                    <Text style={styles.guestEmail}>✉️ {item.guest.email}</Text>
                  )}
                  {!item.guest.lastName && (
                    <Text style={styles.hiddenInfo}>Contact details revealed after approval</Text>
                  )}
                </View>
              )}

              {item.specialRequests ? (
                <Text style={styles.cardNotes}>📝 {item.specialRequests}</Text>
              ) : null}

              {/* req 7.4.4 — open private chat once approved */}
              {item.status === 'approved' && (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => router.push(`/hosting/chat/${item.id}`)}
                >
                  <Text style={styles.chatBtnText}>💬 Open Private Chat</Text>
                </TouchableOpacity>
              )}

              {/* Host actions for pending requests */}
              {tab === 'received' && item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleAction(item.id, 'approve')}
                  >
                    <Text style={styles.actionBtnText}>✅ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleAction(item.id, 'reject')}
                  >
                    <Text style={[styles.actionBtnText, { color: '#f44336' }]}>❌ Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyText}>
                {tab === 'sent'
                  ? 'No requests sent yet.\nFind a host to get started!'
                  : 'No requests received yet.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0f4ff' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:      { marginRight: 12 },
  backText:     { fontSize: 24, color: '#fff' },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#fff' },
  tabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab:          { flex: 1, padding: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#1a3a6b' },
  tabText:      { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive:{ color: '#1a3a6b', fontWeight: '700' },
  list:         { padding: 16, gap: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCity:     { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardDates:    { fontSize: 13, color: '#555', marginBottom: 4 },
  cardMeta:     { fontSize: 13, color: '#777', marginBottom: 8 },
  guestInfo:    { backgroundColor: '#f0f4ff', borderRadius: 10, padding: 10, marginBottom: 8 },
  guestName:    { fontSize: 14, fontWeight: '600', color: '#1a3a6b' },
  guestEmail:   { fontSize: 13, color: '#555', marginTop: 2 },
  hiddenInfo:   { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 2 },
  cardNotes:    { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 8 },
  actions:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn:    { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  approveBtn:   { backgroundColor: '#e8f5e9', borderColor: '#4caf50' },
  rejectBtn:    { backgroundColor: '#fff', borderColor: '#ffcccc' },
  actionBtnText:{ fontWeight: '700', fontSize: 14, color: '#4caf50' },
  chatBtn:      { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: '#e0f7fa', borderWidth: 1, borderColor: '#00bcd4', alignItems: 'center' },
  chatBtnText:  { fontWeight: '700', fontSize: 14, color: '#00838f' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
});
