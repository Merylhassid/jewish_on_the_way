import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import client from '@/src/api/client';
import { useAuth } from '@/src/store/auth';
import { C } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Report {
  id: number;
  entityType: string;
  entityId: number;
  reportType: string;
  description?: string | null;
  status: string;
  adminNote?: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
}

interface PlaceRequest {
  id: number;
  entityType: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
  status: string;
  adminNote?: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
  destination?: { city: string } | null;
}

type Tab = 'reports' | 'requests';

const STATUS_COLOR: Record<string, string> = {
  pending:  '#F59E0B',
  reviewed: '#3B82F6',
  resolved: '#10B981',
  approved: '#10B981',
  rejected: '#EF4444',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[s.badge, { backgroundColor: `${STATUS_COLOR[status] ?? '#9CA3AF'}22` }]}>
      <Text style={[s.badgeText, { color: STATUS_COLOR[status] ?? '#9CA3AF' }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [requests, setRequests] = useState<PlaceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') { router.replace('/(tabs)/profile' as any); }
  }, [user]);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [reps, reqs] = await Promise.all([
        client.get('/reviews/admin/reports'),
        client.get('/reviews/admin/requests'),
      ]);
      setReports(reps.data);
      setRequests(reqs.data);
    } catch {
      Alert.alert('Error', 'Could not load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resolveReport = (id: number, status: 'reviewed' | 'resolved') => {
    Alert.alert(
      'Mark as ' + status,
      `Set report #${id} as ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await client.post(`/reviews/admin/reports/${id}/resolve`, { status });
              setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
            } catch { Alert.alert('Error', 'Could not update report'); }
          },
        },
      ],
    );
  };

  const resolveRequest = (id: number, status: 'approved' | 'rejected') => {
    Alert.alert(
      status === 'approved' ? 'Approve suggestion' : 'Reject suggestion',
      `${status === 'approved' ? 'Approve' : 'Reject'} request #${id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await client.post(`/reviews/admin/requests/${id}/resolve`, { status });
              setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
            } catch { Alert.alert('Error', 'Could not update request'); }
          },
        },
      ],
    );
  };

  const pendingReports   = reports.filter(r => r.status === 'pending').length;
  const pendingRequests  = requests.filter(r => r.status === 'pending').length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color="#fff" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ADMIN</Text>
          <Text style={s.headerTitle}>Control Panel</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tab, tab === 'reports' && s.tabActive]}
          onPress={() => setTab('reports')}
        >
          <Text style={[s.tabText, tab === 'reports' && s.tabTextActive]}>
            Reports{pendingReports > 0 ? ` (${pendingReports})` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[s.tab, tab === 'requests' && s.tabActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[s.tabText, tab === 'requests' && s.tabTextActive]}>
            Suggestions{pendingRequests > 0 ? ` (${pendingRequests})` : ''}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'reports' && (
            reports.length === 0
              ? <Text style={s.empty}>No reports yet</Text>
              : reports.map(r => (
                <View key={r.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>
                        {r.entityType === 'restaurant' ? '🍽' : '🕍'} {r.entityType} #{r.entityId}
                      </Text>
                      <Text style={s.cardSub}>{r.user?.firstName} {r.user?.lastName} · {fmtDate(r.createdAt)}</Text>
                    </View>
                    <StatusBadge status={r.status} />
                  </View>

                  <View style={s.tagRow}>
                    <View style={s.typeTag}><Text style={s.typeTagText}>{r.reportType}</Text></View>
                  </View>

                  {r.description ? (
                    <Text style={s.description}>{r.description}</Text>
                  ) : null}

                  {r.status === 'pending' && (
                    <View style={s.actionRow}>
                      <Pressable style={[s.actionBtn, s.btnBlue]} onPress={() => resolveReport(r.id, 'reviewed')}>
                        <Text style={s.actionBtnText}>Mark Reviewed</Text>
                      </Pressable>
                      <Pressable style={[s.actionBtn, s.btnGreen]} onPress={() => resolveReport(r.id, 'resolved')}>
                        <Text style={s.actionBtnText}>Resolve</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
          )}

          {tab === 'requests' && (
            requests.length === 0
              ? <Text style={s.empty}>No suggestions yet</Text>
              : requests.map(r => (
                <View key={r.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>
                        {r.entityType === 'restaurant' ? '🍽' : '🕍'} {r.name}
                      </Text>
                      <Text style={s.cardSub}>
                        {r.user?.firstName} {r.user?.lastName}
                        {r.destination ? ` · ${r.destination.city}` : ''}
                        {' · '}{fmtDate(r.createdAt)}
                      </Text>
                    </View>
                    <StatusBadge status={r.status} />
                  </View>

                  {(r.address || r.phone) ? (
                    <View style={s.infoRow}>
                      {r.address ? <Text style={s.infoText}>📍 {r.address}</Text> : null}
                      {r.phone   ? <Text style={s.infoText}>📞 {r.phone}</Text>   : null}
                    </View>
                  ) : null}

                  {r.notes ? <Text style={s.description}>{r.notes}</Text> : null}

                  {r.status === 'pending' && (
                    <View style={s.actionRow}>
                      <Pressable style={[s.actionBtn, s.btnGreen]} onPress={() => resolveRequest(r.id, 'approved')}>
                        <Text style={s.actionBtnText}>Approve</Text>
                      </Pressable>
                      <Pressable style={[s.actionBtn, s.btnRed]} onPress={() => resolveRequest(r.id, 'rejected')}>
                        <Text style={s.actionBtnText}>Reject</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 22, color: '#fff', letterSpacing: -0.5 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: C.navy },
  tabText:       { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#9CA3AF' },
  tabTextActive: { color: C.navy },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16,
    shadowColor: C.navy, shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle:   { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#111827' },
  cardSub:     { fontFamily: 'Inter-Regular', fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 0.5 },

  tagRow:      { flexDirection: 'row', marginBottom: 8 },
  typeTag:     { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeTagText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: '#374151' },

  description: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#6B7280', marginBottom: 10, lineHeight: 19 },

  infoRow:  { marginBottom: 8, gap: 3 },
  infoText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#6B7280' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { fontFamily: 'Inter-Bold', fontSize: 13, color: '#fff' },
  btnBlue:  { backgroundColor: '#3B82F6' },
  btnGreen: { backgroundColor: '#10B981' },
  btnRed:   { backgroundColor: '#EF4444' },

  empty: { fontFamily: 'Inter-Regular', color: '#9CA3AF', fontSize: 15, textAlign: 'center', marginTop: 60 },
});
