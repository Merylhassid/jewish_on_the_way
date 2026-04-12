import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import client from '@/src/api/client';

interface Minyan {
  id: number;
  prayerType: string;
  date: string;
  time: string;
  locationText: string;
  notes?: string;
  participantsCount: number;
  almostFull: boolean;
  isFull: boolean;
  creator: { id: number; firstName: string; lastName: string } | null;
}

const PRAYER_TYPES = ['shacharit', 'mincha', 'maariv', 'musaf', 'other'];
const PRAYER_EMOJI: Record<string, string> = {
  shacharit: '🌅', mincha: '🌤️', maariv: '🌙', musaf: '✨', other: '🙏',
};
const PRAYER_LABEL: Record<string, string> = {
  shacharit: 'Shacharit', mincha: 'Mincha', maariv: "Ma'ariv", musaf: 'Musaf', other: 'Other',
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Create Minyan Modal ───────────────────────────────────────────────────────
function CreateMinyanModal({
  visible, onClose, destinationId, onCreated,
}: { visible: boolean; onClose: () => void; destinationId: number; onCreated: () => void }) {
  const [prayerType, setPrayerType] = useState('shacharit');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationText, setLocationText] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Error', 'Date must be YYYY-MM-DD'); return; }
    if (!time.match(/^\d{2}:\d{2}$/))         { Alert.alert('Error', 'Time must be HH:MM');       return; }
    if (!locationText.trim())                  { Alert.alert('Error', 'Location is required');      return; }
    try {
      setLoading(true);
      await client.post('/minyans', {
        prayerType, date, time,
        locationText: locationText.trim(),
        notes: notes.trim() || undefined,
        destinationId,
      });
      onCreated();
      onClose();
      setDate(''); setTime(''); setLocationText(''); setNotes(''); setPrayerType('shacharit');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to create minyan';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Create a Minyan</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>

          <Text style={styles.label}>Prayer Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PRAYER_TYPES.map((p) => (
                <Pressable key={p} style={[styles.typeChip, prayerType === p && styles.typeChipActive]} onPress={() => setPrayerType(p)}>
                  <Text style={[styles.typeChipText, prayerType === p && styles.typeChipTextActive]}>
                    {PRAYER_EMOJI[p]} {PRAYER_LABEL[p]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate}
            placeholder="e.g. 2026-04-25" placeholderTextColor="#999" />

          <Text style={styles.label}>Time (HH:MM)</Text>
          <TextInput style={styles.input} value={time} onChangeText={setTime}
            placeholder="e.g. 08:00" placeholderTextColor="#999" />

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={locationText} onChangeText={setLocationText}
            placeholder="e.g. Great Synagogue, 2nd floor" placeholderTextColor="#999" />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes}
            placeholder="Any special instructions…" placeholderTextColor="#999" multiline />

          <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Minyan</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MinyansScreen() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const [minyans, setMinyans] = useState<Minyan[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [createVisible, setCreateVisible] = useState(false);

  const fetchMinyans = async (prayerType?: string) => {
    try {
      setLoading(true);
      const params: any = { destinationId };
      if (prayerType && prayerType !== 'all') params.prayerType = prayerType;
      const res = await client.get('/minyans', { params });
      setMinyans(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMinyans(typeFilter); }, [typeFilter]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🤝 Minyans</Text>
          <Text style={styles.headerSub}>{minyans.length} upcoming</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {['all', ...PRAYER_TYPES].map((f) => (
          <Pressable key={f} style={[styles.chip, typeFilter === f && styles.chipActive]} onPress={() => setTypeFilter(f)}>
            <Text style={[styles.chipText, typeFilter === f && styles.chipTextActive]}>
              {f === 'all' ? 'All' : `${PRAYER_EMOJI[f]} ${PRAYER_LABEL[f]}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>
      ) : (
        <FlatList
          data={minyans}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/minyan/${item.id}`)}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardEmoji}>{PRAYER_EMOJI[item.prayerType] ?? '🙏'}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardPrayer}>{PRAYER_LABEL[item.prayerType]}</Text>
                  {item.isFull && <View style={[styles.badge, { backgroundColor: '#4caf50' }]}><Text style={styles.badgeText}>Full ✓</Text></View>}
                  {item.almostFull && !item.isFull && <View style={[styles.badge, { backgroundColor: '#ff9800' }]}><Text style={styles.badgeText}>Almost full!</Text></View>}
                </View>
                <Text style={styles.cardDate}>{formatDate(item.date)} • {item.time}</Text>
                <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.locationText}</Text>
                <Text style={styles.cardCount}>👥 {item.participantsCount} / 10</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🤝</Text>
              <Text style={styles.emptyText}>No upcoming minyans.{'\n'}Be the first to create one!</Text>
            </View>
          }
        />
      )}

      <CreateMinyanModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        destinationId={Number(destinationId)}
        onCreated={() => fetchMinyans(typeFilter)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f0f4ff' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  header:           { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:          { marginRight: 12 },
  backText:         { fontSize: 24, color: '#fff' },
  headerCenter:     { flex: 1 },
  headerTitle:      { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:        { fontSize: 13, color: '#a8c4e8', marginTop: 2 },
  addBtn:           { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:       { color: '#1a3a6b', fontWeight: '700', fontSize: 14 },
  filterRow:        { maxHeight: 48, backgroundColor: '#fff' },
  filterContent:    { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  chipActive:       { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  chipText:         { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive:   { color: '#fff' },
  list:             { padding: 16, gap: 12 },
  card:             { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardLeft:         { marginRight: 14 },
  cardEmoji:        { fontSize: 32 },
  cardBody:         { flex: 1, gap: 3 },
  cardTopRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardPrayer:       { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  badge:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:        { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardDate:         { fontSize: 13, color: '#555' },
  cardLocation:     { fontSize: 13, color: '#777' },
  cardCount:        { fontSize: 13, color: '#1a3a6b', fontWeight: '600', marginTop: 2 },
  arrow:            { fontSize: 22, color: '#bbb', marginLeft: 8 },
  empty:            { alignItems: 'center', marginTop: 60 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyText:        { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  // Modal
  overlay:          { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:       { fontSize: 20, fontWeight: '700', color: '#1a3a6b' },
  closeBtn:         { fontSize: 18, color: '#999' },
  label:            { fontSize: 13, fontWeight: '600', color: '#1a3a6b', marginBottom: 6 },
  input:            { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: '#dde3f0', color: '#1a1a2e' },
  typeChip:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  typeChipActive:   { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  typeChipText:     { fontSize: 13, color: '#555', fontWeight: '500' },
  typeChipTextActive:{ color: '#fff' },
  submitBtn:        { backgroundColor: '#1a3a6b', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  submitText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
});
