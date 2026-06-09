import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ArrowLeft, Calendar, Clock,
  MapPin, Navigation, RefreshCw, Users,
} from 'lucide-react-native';
import client from '@/src/api/client';
import SwipeableSheet from '@/src/components/SwipeableSheet';
import { getPrayerConfig } from '@/src/utils/prayerIcons';

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
  distanceMeters?: number;
  creator: { id: number; firstName: string; lastName: string } | null;
}

const PRAYER_TYPES = ['shacharit', 'mincha', 'maariv', 'musaf', 'other'];

function formatDate(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function PrayerTypeChip({ type, label, active }: { type: string; label: string; active: boolean }) {
  const cfg = getPrayerConfig(type);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <cfg.Icon size={12} color={active ? '#fff' : cfg.color} strokeWidth={2} />
      <Text style={{ fontSize: 13, color: active ? '#fff' : '#555', fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

// ─── Create Minyan Modal ───────────────────────────────────────────────────────
function CreateMinyanModal({
  visible, onClose, destinationId, onCreated, userLocation,
}: {
  visible: boolean;
  onClose: () => void;
  destinationId: number;
  onCreated: () => void;
  userLocation: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  const PRAYER_LABEL: Record<string, string> = {
    shacharit: t('minyans.shacharit'), mincha: t('minyans.mincha'),
    maariv: t('minyans.maariv'), musaf: t('minyans.musaf'), other: t('minyans.other'),
  };
  const [prayerType, setPrayerType] = useState('shacharit');
  const [dateObj, setDateObj] = useState(new Date());
  const [timeObj, setTimeObj] = useState(() => { const d = new Date(); d.setMinutes(0, 0, 0); return d; });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = `${String(timeObj.getHours()).padStart(2, '0')}:${String(timeObj.getMinutes()).padStart(2, '0')}`;

  const handleCreate = async () => {
    if (!locationText.trim()) { Alert.alert(t('common.error'), t('minyans.location')); return; }
    try {
      setLoading(true);
      await client.post('/minyans', {
        prayerType, date: dateStr, time: timeStr,
        locationText: locationText.trim(),
        notes: notes.trim() || undefined,
        destinationId,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      });
      onCreated();
      onClose();
      setDateObj(new Date()); setTimeObj(new Date()); setLocationText(''); setNotes(''); setPrayerType('shacharit');
      Alert.alert(t('minyans.minyanCreated'), t('minyans.firstParticipant'));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to create minyan';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('minyans.createTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>

          <Text style={styles.label}>{t('minyans.prayerType')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PRAYER_TYPES.map((p) => {
                const cfg = getPrayerConfig(p);
                const isActive = prayerType === p;
                return (
                  <Pressable key={p} style={[styles.typeChip, isActive && styles.typeChipActive]} onPress={() => setPrayerType(p)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <cfg.Icon size={13} color={isActive ? '#fff' : cfg.color} strokeWidth={2} />
                      <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>{PRAYER_LABEL[p]}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={styles.label}>{t('minyans.date')}</Text>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <View style={styles.pickerBtn} lang="en" dir="ltr">
              {/* @ts-ignore */}
              <input type="date" value={dateStr} min={new Date().toISOString().split('T')[0]}
                onChange={(e: any) => { if (e.target.value) setDateObj(new Date(e.target.value)); }}
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', fontWeight: '500', outline: 'none', width: '100%', cursor: 'pointer' }} />
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color="#1a3a6b" strokeWidth={2} />
                  <Text style={styles.pickerBtnText}>{dateStr}</Text>
                </View>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker value={dateObj} mode="date" minimumDate={new Date()}
                  onChange={(_, d) => { setShowDatePicker(false); if (d) setDateObj(d); }} />
              )}
            </>
          )}

          <Text style={styles.label}>{t('minyans.time')}</Text>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <View style={styles.pickerBtn} lang="en" dir="ltr">
              {/* @ts-ignore */}
              <input type="time" value={timeStr}
                onChange={(e: any) => { if (e.target.value) { const [h, m] = e.target.value.split(':'); const t = new Date(); t.setHours(+h, +m, 0, 0); setTimeObj(t); } }}
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', fontWeight: '500', outline: 'none', width: '100%', cursor: 'pointer' }} />
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color="#1a3a6b" strokeWidth={2} />
                  <Text style={styles.pickerBtnText}>{timeStr}</Text>
                </View>
              </Pressable>
              {showTimePicker && (
                <DateTimePicker value={timeObj} mode="time" is24Hour
                  onChange={(_, t) => { setShowTimePicker(false); if (t) setTimeObj(t); }} />
              )}
            </>
          )}

          <Text style={styles.label}>{t('minyans.location')}</Text>
          <TextInput style={styles.input} value={locationText} onChangeText={setLocationText}
            placeholder={t('minyans.locationPlaceholder')} placeholderTextColor="#999" />

          <Text style={styles.label}>{t('minyans.notesOptional')}</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes}
            placeholder={t('minyans.notesPlaceholder')} placeholderTextColor="#999" multiline />

          {userLocation && (
            <Text style={styles.locationNote}>{t('minyans.locationNote')}</Text>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('minyans.createBtn')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MinyansScreen() {
  const { destinationId, city } = useLocalSearchParams<{ destinationId: string; city?: string }>();
  const { t } = useTranslation();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stable
  const PRAYER_LABEL: Record<string, string> = {
    shacharit: t('minyans.shacharit'), mincha: t('minyans.mincha'),
    maariv: t('minyans.maariv'), musaf: t('minyans.musaf'), other: t('minyans.other'),
  };
  const [minyans, setMinyans] = useState<Minyan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [createVisible, setCreateVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  const fetchMinyans = async (prayerType?: string) => {
    try {
      setLoading(true);
      const params: Record<string, string> = { destinationId };
      if (prayerType && prayerType !== 'all') params.prayerType = prayerType;
      if (userLocation) {
        params.lat = String(userLocation.lat);
        params.lng = String(userLocation.lng);
      }
      const res = await client.get('/minyans', { params });
      setMinyans(res.data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchMinyans(typeFilter); }, [typeFilter, userLocation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.headerTitle}>{t('minyans.title')}{city ? ` — ${city}` : ''}</Text>
          </View>
          <Text style={styles.headerSub}>
            {minyans.length} {t('minyans.upcoming')}
          </Text>
        </View>
        <TouchableOpacity style={styles.myBtn} onPress={() => router.push('/minyans/my-minyans')}>
          <Text style={styles.myBtnText}>{t('minyans.my')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
          <Text style={styles.addBtnText}>{t('minyans.newBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {['all', ...PRAYER_TYPES].map((f) => (
          <Pressable key={f} style={[styles.chip, typeFilter === f && styles.chipActive]} onPress={() => setTypeFilter(f)}>
            {f === 'all' ? (
              <Text style={[styles.chipText, typeFilter === f && styles.chipTextActive]}>{t('minyans.all')}</Text>
            ) : (
              <PrayerTypeChip type={f} label={PRAYER_LABEL[f]} active={typeFilter === f} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>
      ) : fetchError ? (
        <View style={styles.center}>
          <View style={{ marginBottom: 12 }}>
            <AlertTriangle size={36} color="#F59E0B" strokeWidth={1.5} />
          </View>
          <Text style={{ fontSize: 15, color: '#888', marginBottom: 16 }}>שגיאה בטעינת הנתונים</Text>
          <Pressable
            style={{ backgroundColor: '#1a3a6b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={() => fetchMinyans(typeFilter)}
          >
            <RefreshCw size={14} color="#fff" strokeWidth={2} />
            <Text style={{ color: '#fff', fontWeight: '700' }}>נסה שוב</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={minyans}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchMinyans(typeFilter); }}
              colors={['#1a3a6b']}
              tintColor="#1a3a6b"
            />
          }
          renderItem={({ item }) => {
            const cfg = getPrayerConfig(item.prayerType);
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/minyan/${item.id}`)}>
                <View style={[styles.cardIconBox, { backgroundColor: cfg.bg }]}>
                  <cfg.Icon size={22} color={cfg.color} strokeWidth={2} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardPrayer}>{PRAYER_LABEL[item.prayerType]}</Text>
                    {item.isFull && <View style={[styles.badge, { backgroundColor: '#4caf50' }]}><Text style={styles.badgeText}>{t('minyans.full')}</Text></View>}
                    {item.almostFull && !item.isFull && <View style={[styles.badge, { backgroundColor: '#ff9800' }]}><Text style={styles.badgeText}>{t('minyans.almostFull')}</Text></View>}
                  </View>
                  <Text style={styles.cardDate}>{formatDate(item.date)} • {item.time}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
                    <Text style={[styles.cardLocation, { flex: 1 }]} numberOfLines={1}>{item.locationText}</Text>
                  </View>
                  <View style={styles.cardBottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Users size={12} color="#1a3a6b" strokeWidth={2} />
                      <Text style={styles.cardCount}>{item.participantsCount} / 10</Text>
                    </View>
                    {item.distanceMeters !== undefined && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Navigation size={12} color="#555" strokeWidth={2} />
                        <Text style={styles.cardDistance}>{formatDistance(item.distanceMeters)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Users size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={styles.emptyText}>{t('minyans.noMinyans')}{'\n'}{t('minyans.noMinyansCreate')}</Text>
            </View>
          }
        />
      )}

      <CreateMinyanModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        destinationId={Number(destinationId)}
        onCreated={() => fetchMinyans(typeFilter)}
        userLocation={userLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f0f4ff' },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  header:             { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:            { marginRight: 12 },
  headerCenter:       { flex: 1 },
  headerTitle:        { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:          { fontSize: 13, color: '#a8c4e8', marginTop: 2 },
  myBtn:              { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  myBtnText:          { color: '#fff', fontWeight: '600', fontSize: 13 },
  addBtn:             { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 44 },
  addBtnText:         { color: '#1a3a6b', fontWeight: '700', fontSize: 14 },
  filterRow:          { maxHeight: 48, backgroundColor: '#fff' },
  filterContent:      { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip:               { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  chipActive:         { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  chipText:           { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive:     { color: '#fff' },
  list:               { padding: 16, gap: 12 },
  card:               { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardIconBox:        { width: 46, height: 46, borderRadius: 12, marginRight: 14, justifyContent: 'center', alignItems: 'center' },
  cardBody:           { flex: 1, gap: 3 },
  cardTopRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardPrayer:         { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  badge:              { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:          { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardDate:           { fontSize: 13, color: '#555' },
  cardLocation:       { fontSize: 13, color: '#777' },
  cardBottomRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  cardCount:          { fontSize: 13, color: '#1a3a6b', fontWeight: '600' },
  cardDistance:       { fontSize: 13, color: '#555', fontWeight: '500' },
  arrow:              { fontSize: 22, color: '#bbb', marginLeft: 8 },
  empty:              { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText:          { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  // Modal
  overlay:            { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:              { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:         { fontSize: 20, fontWeight: '700', color: '#1a3a6b' },
  closeBtn:           { fontSize: 18, color: '#999' },
  label:              { fontSize: 13, fontWeight: '600', color: '#1a3a6b', marginBottom: 6 },
  input:              { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: '#dde3f0', color: '#1a1a2e' },
  typeChip:           { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  typeChipActive:     { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  typeChipText:       { fontSize: 13, color: '#555', fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  locationNote:       { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 12 },
  pickerBtn:          { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#dde3f0' },
  pickerBtnText:      { fontSize: 15, color: '#1a1a2e', fontWeight: '500' },
  submitBtn:          { backgroundColor: '#1a3a6b', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  submitText:         { color: '#fff', fontSize: 16, fontWeight: '600' },
});
