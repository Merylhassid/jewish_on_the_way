import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '@/src/api/client';
import { useAuth } from '@/src/store/auth';

interface MinyanDetail {
  id: number;
  prayerType: string;
  date: string;
  time: string;
  locationText: string;
  notes?: string | null;
  participantsCount: number;
  almostFull: boolean;
  isFull: boolean;
  isRegistered: boolean;
  creator: { id: number; firstName: string; lastName: string } | null;
  destination: { id: number; city: string } | null;
}

const PRAYER_EMOJI: Record<string, string> = {
  shacharit: '🌅', mincha: '🌤️', maariv: '🌙', musaf: '✨', other: '🙏',
};
const PRAYER_LABEL: Record<string, string> = {
  shacharit: 'Shacharit', mincha: 'Mincha', maariv: "Ma'ariv", musaf: 'Musaf', other: 'Other',
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function MinyanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [minyan, setMinyan] = useState<MinyanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const fetch = async () => {
    try {
      const res = await client.get(`/minyans/${id}`);
      setMinyan(res.data);
    } catch {
      Alert.alert('Error', 'Could not load minyan');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [id]);

  const handleRegister = async () => {
    if (!minyan) return;
    try {
      setActionLoading(true);
      const res = await client.post(`/minyans/${id}/register`);
      setMinyan((prev) => prev ? { ...prev, isRegistered: true, participantsCount: res.data.participantsCount } : prev);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to register';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      const res = await client.delete(`/minyans/${id}/register`);
      setMinyan((prev) => prev ? { ...prev, isRegistered: false, participantsCount: res.data.participantsCount } : prev);
      setCancelConfirm(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>;
  }

  if (!minyan) return null;

  const isCreator = minyan.creator?.id === user?.id;
  const count = minyan.participantsCount;
  const progressWidth = Math.min((count / 10) * 100, 100);
  const progressColor = minyan.isFull ? '#4caf50' : minyan.almostFull ? '#ff9800' : '#1a3a6b';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerEmoji}>{PRAYER_EMOJI[minyan.prayerType] ?? '🙏'}</Text>
        <Text style={styles.headerTitle}>{PRAYER_LABEL[minyan.prayerType]}</Text>
        {minyan.destination && (
          <Text style={styles.headerSub}>📍 {minyan.destination.city}</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Badges */}
        <View style={styles.badgeRow}>
          {minyan.isFull && (
            <View style={[styles.badge, { backgroundColor: '#4caf50' }]}>
              <Text style={styles.badgeText}>✓ Minyan Complete!</Text>
            </View>
          )}
          {minyan.almostFull && !minyan.isFull && (
            <View style={[styles.badge, { backgroundColor: '#ff9800' }]}>
              <Text style={styles.badgeText}>🔥 Almost Full!</Text>
            </View>
          )}
          {minyan.isRegistered && (
            <View style={[styles.badge, { backgroundColor: '#1a3a6b' }]}>
              <Text style={styles.badgeText}>✓ You're registered</Text>
            </View>
          )}
        </View>

        {/* Info cards */}
        <View style={styles.card}>
          <InfoRow icon="📅" label="Date" value={formatDate(minyan.date)} />
          <InfoRow icon="🕐" label="Time" value={minyan.time} />
          <InfoRow icon="📍" label="Location" value={minyan.locationText} />
          {minyan.notes && <InfoRow icon="📝" label="Notes" value={minyan.notes} />}
          {minyan.creator && (
            <InfoRow icon="👤" label="Organiser" value={`${minyan.creator.firstName} ${minyan.creator.lastName}`} />
          )}
        </View>

        {/* Participants progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Participants</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` as any, backgroundColor: progressColor }]} />
          </View>
          <Text style={styles.progressLabel}>{count} / 10 men</Text>
          <Text style={styles.progressSub}>A minyan requires 10 men</Text>
        </View>

        {/* Action button */}
        {!isCreator && (
          minyan.isRegistered ? (
            cancelConfirm ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>Cancel your registration?</Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={styles.confirmKeepBtn} onPress={() => setCancelConfirm(false)}>
                    <Text style={styles.confirmKeepText}>Keep</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleCancel} disabled={actionLoading}>
                    {actionLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmCancelText}>Yes, Cancel</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelConfirm(true)}>
                <Text style={styles.cancelBtnText}>Cancel My Registration</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.registerBtn, minyan.isFull && styles.registerBtnDisabled]}
              onPress={handleRegister}
              disabled={actionLoading || minyan.isFull}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.registerBtnText}>
                    {minyan.isFull ? 'Minyan is full' : 'Join this Minyan'}
                  </Text>}
            </TouchableOpacity>
          )
        )}

        {isCreator && (
          <View style={styles.creatorNote}>
            <Text style={styles.creatorNoteText}>⭐ You created this minyan</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4ff' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  backBtn:        { position: 'absolute', top: 60, left: 20 },
  backText:       { fontSize: 24, color: '#fff' },
  headerEmoji:    { fontSize: 52, marginBottom: 8 },
  headerTitle:    { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSub:      { fontSize: 14, color: '#a8c4e8' },
  body:           { padding: 16, gap: 14 },
  badgeRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle:      { fontSize: 14, fontWeight: '700', color: '#1a3a6b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:        { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f4ff' },
  infoIcon:       { fontSize: 18, width: 32 },
  infoContent:    { flex: 1 },
  infoLabel:      { fontSize: 12, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue:      { fontSize: 15, color: '#1a1a2e', marginTop: 2 },
  progressTrack:  { height: 12, backgroundColor: '#f0f4ff', borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 6 },
  progressLabel:  { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  progressSub:    { fontSize: 12, color: '#999', marginTop: 2 },
  registerBtn:    { backgroundColor: '#1a3a6b', borderRadius: 14, padding: 18, alignItems: 'center' },
  registerBtnDisabled: { backgroundColor: '#ccc' },
  registerBtnText:{ color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn:       { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#ffcccc' },
  cancelBtnText:   { color: '#e53935', fontSize: 16, fontWeight: '600' },
  confirmBox:      { backgroundColor: '#fff0f0', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#ffcccc' },
  confirmText:     { fontSize: 14, color: '#c00', textAlign: 'center', marginBottom: 12 },
  confirmRow:      { flexDirection: 'row', gap: 10 },
  confirmKeepBtn:  { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f0f4ff', alignItems: 'center' },
  confirmKeepText: { fontSize: 15, fontWeight: '600', color: '#1a3a6b' },
  confirmCancelBtn:{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#e53935', alignItems: 'center' },
  confirmCancelText:{ fontSize: 15, fontWeight: '600', color: '#fff' },
  creatorNote:    { backgroundColor: '#e8eef8', borderRadius: 14, padding: 16, alignItems: 'center' },
  creatorNoteText:{ color: '#1a3a6b', fontSize: 14, fontWeight: '600' },
});
