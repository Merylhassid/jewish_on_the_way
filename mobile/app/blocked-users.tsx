import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { ChevronRight, ShieldOff } from 'lucide-react-native';
import client from '@/src/api/client';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';

interface BlockedUser {
  id: number;
  firstName: string;
  lastName: string;
  blockedAt: string;
}

function BlockedUsersScreen() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await client.get('/users/me/blocked');
      setUsers(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUnblock = (id: number, name: string) => {
    Alert.alert('Unblock', `Unblock ${name}? They will be able to see and contact you again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await client.delete(`/users/${id}/block`);
            setUsers(prev => prev.filter(u => u.id !== id));
          } catch { Alert.alert('Error', 'Could not unblock this user'); }
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
        <Text style={s.headerTitle}>Blocked Users</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.card}>
              <Text style={s.name}>{item.firstName} {item.lastName}</Text>
              <TouchableOpacity style={s.unblockBtn} onPress={() => handleUnblock(item.id, item.firstName)}>
                <Text style={s.unblockBtnText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <ShieldOff size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No blocked users</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

export default withProtectedRoute(BlockedUsersScreen, 'account');

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 22, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.goldBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 22, color: C.navy },

  list: { padding: 16, gap: 10 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(11,23,54,0.08)',
  },
  name: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.textPrimary },

  unblockBtn: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: C.goldBorder, backgroundColor: '#fff',
  },
  unblockBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.navy },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
});
