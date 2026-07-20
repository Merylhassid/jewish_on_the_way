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
import { withProtectedRoute } from '@/src/auth/auth-gates';
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

interface UserReport {
  id: number;
  context: 'hosting_chat' | 'hosting_offer' | 'community';
  entityId: number;
  reason?: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
  reporter?: { id: number; firstName: string; lastName: string; email: string } | null;
  reportedUser?: { id: number; firstName: string; lastName: string; email: string } | null;
}

type Tab = 'reports' | 'requests' | 'users';

const STATUS_COLOR: Record<string, string> = {
  pending:  C.goldMuted,
  open:     C.goldMuted,
  reviewed: C.typeDairy,
  resolved: C.typeParve,
  approved: C.typeParve,
  rejected: C.error,
};

const CONTEXT_LABEL: Record<string, string> = {
  hosting_chat:  'Hosting Chat',
  hosting_offer: 'Hosting Offer',
  community:     'Community Post',
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

function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [requests, setRequests] = useState<PlaceRequest[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') { router.replace('/(tabs)/profile' as any); }
  }, [user]);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [reps, reqs, userReps] = await Promise.all([
        client.get('/reviews/admin/reports'),
        client.get('/reviews/admin/requests'),
        client.get('/admin/user-reports'),
      ]);
      setReports(reps.data);
      setRequests(reqs.data);
      setUserReports(userReps.data);
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

  const resolveUserReport = (id: number) => {
    Alert.alert('Mark resolved', `Set report #${id} as resolved?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await client.post(`/admin/user-reports/${id}/resolve`, { status: 'resolved' });
            setUserReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
          } catch { Alert.alert('Error', 'Could not update report'); }
        },
      },
    ]);
  };

  const disableUser = (userId: number, name: string) => {
    Alert.alert(
      'Disable user',
      `Disable ${name}? They will be immediately signed out and unable to log back in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable', style: 'destructive',
          onPress: async () => {
            try {
              await client.post(`/admin/users/${userId}/disable`);
              Alert.alert('Done', `${name} has been disabled.`);
            } catch { Alert.alert('Error', 'Could not disable user'); }
          },
        },
      ],
    );
  };

  const pendingReports   = reports.filter(r => r.status === 'pending').length;
  const pendingRequests  = requests.filter(r => r.status === 'pending').length;
  const pendingUserReports = userReports.filter(r => r.status === 'open').length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color={C.navy} strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
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
        <Pressable
          style={[s.tab, tab === 'users' && s.tabActive]}
          onPress={() => setTab('users')}
        >
          <Text style={[s.tabText, tab === 'users' && s.tabTextActive]}>
            Users{pendingUserReports > 0 ? ` (${pendingUserReports})` : ''}
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

          {tab === 'users' && (
            userReports.length === 0
              ? <Text style={s.empty}>No user reports yet</Text>
              : userReports.map(r => (
                <View key={r.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>
                        🚩 {r.reportedUser?.firstName} {r.reportedUser?.lastName}
                      </Text>
                      <Text style={s.cardSub}>
                        Reported by {r.reporter?.firstName} {r.reporter?.lastName} · {fmtDate(r.createdAt)}
                      </Text>
                    </View>
                    <StatusBadge status={r.status} />
                  </View>

                  <View style={s.tagRow}>
                    <View style={s.typeTag}><Text style={s.typeTagText}>{CONTEXT_LABEL[r.context] ?? r.context}</Text></View>
                  </View>

                  {r.reason ? <Text style={s.description}>{r.reason}</Text> : null}

                  <View style={s.actionRow}>
                    {r.status === 'open' && (
                      <Pressable style={[s.actionBtn, s.btnBlue]} onPress={() => resolveUserReport(r.id)}>
                        <Text style={s.actionBtnText}>Mark Resolved</Text>
                      </Pressable>
                    )}
                    {r.reportedUser && (
                      <Pressable
                        style={[s.actionBtn, s.btnRed]}
                        onPress={() => disableUser(r.reportedUser!.id, `${r.reportedUser!.firstName} ${r.reportedUser!.lastName}`)}
                      >
                        <Text style={s.actionBtnText}>Disable User</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default withProtectedRoute(AdminScreen, 'account');

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', gap: 14,
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
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 26, color: C.navy },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(11,23,54,0.07)',
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: C.goldMuted },
  tabText:       { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.textMuted },
  tabTextActive: { color: C.navy },

  card: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy, shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle:   { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#111827' },
  cardSub:     { fontFamily: 'Inter-Regular', fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 0.5 },

  tagRow:      { flexDirection: 'row', marginBottom: 8 },
  typeTag:     { backgroundColor: C.kashrutNeutralBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(107,114,128,0.14)' },
  typeTagText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.kashrutNeutral },

  description: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#6B7280', marginBottom: 10, lineHeight: 19 },

  infoRow:  { marginBottom: 8, gap: 3 },
  infoText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#6B7280' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { fontFamily: 'Inter-Bold', fontSize: 13, color: '#fff' },
  btnBlue:  { backgroundColor: C.typeDairy },
  btnGreen: { backgroundColor: C.typeParve },
  btnRed:   { backgroundColor: C.error },

  empty: { fontFamily: 'Inter-Regular', color: '#9CA3AF', fontSize: 15, textAlign: 'center', marginTop: 60 },
});
