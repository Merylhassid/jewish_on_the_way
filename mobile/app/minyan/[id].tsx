import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { io, Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Calendar, Clock, Crown,
  FileText, Flame, MapPin, MessageCircle, User,
} from 'lucide-react-native';
import client, { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';
import HomeButton from '@/src/components/HomeButton';
import { getPrayerConfig } from '@/src/utils/prayerIcons';
import { C } from '@/constants/theme';
import { useRequireAuth } from '@/src/auth/auth-gates';

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
  creator: { id?: number; firstName: string; lastName: string } | null;
  destination: { id: number; city: string } | null;
}

interface Participant {
  id: number;
  firstName: string;
  lastName: string;
}

function formatDate(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const PRAYER_TYPES = ['shacharit', 'mincha', 'maariv', 'musaf', 'other'];

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditMinyanModal({
  visible, onClose, minyan, onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  minyan: MinyanDetail;
  onSaved: (updated: Partial<MinyanDetail>) => void;
}) {
  const { t } = useTranslation();
  const PRAYER_LABEL: Record<string, string> = {
    shacharit: t('minyans.shacharit'), mincha: t('minyans.mincha'),
    maariv: t('minyans.maariv'), musaf: t('minyans.musaf'), other: t('minyans.other'),
  };
  const [prayerType, setPrayerType]   = useState(minyan.prayerType);
  const [dateObj, setDateObj]         = useState(() => {
    const [y, m, d] = minyan.date.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
  });
  const [timeObj, setTimeObj]         = useState(() => {
    const [h, mi] = minyan.time.split(':');
    const t2 = new Date(); t2.setHours(+h, +mi, 0, 0); return t2;
  });
  const [locationText, setLocationText] = useState(minyan.locationText);
  const [notes, setNotes]             = useState(minyan.notes ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving]           = useState(false);

  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = `${String(timeObj.getHours()).padStart(2, '0')}:${String(timeObj.getMinutes()).padStart(2, '0')}`;

  const handleSave = async () => {
    if (!locationText.trim()) { Alert.alert(t('common.error'), t('minyans.location')); return; }
    try {
      setSaving(true);
      const res = await client.patch(`/minyans/${minyan.id}`, {
        prayerType, date: dateStr, time: timeStr,
        locationText: locationText.trim(),
        notes: notes.trim() || undefined,
      });
      onSaved(res.data);
      onClose();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={es.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={es.sheetWrap}>
          <ScrollView style={es.sheet} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={es.header}>
              <Text style={es.title}>{t('minyans.editTitle')}</Text>
              <Pressable onPress={onClose} hitSlop={12}><Text style={es.close}>✕</Text></Pressable>
            </View>

            <Text style={es.label}>{t('minyans.prayerType')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRAYER_TYPES.map((p) => {
                  const cfg = getPrayerConfig(p);
                  const isActive = prayerType === p;
                  return (
                    <Pressable key={p} style={[es.chip, isActive && es.chipActive]} onPress={() => setPrayerType(p)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <cfg.Icon size={13} color={isActive ? '#fff' : cfg.color} strokeWidth={2} />
                        <Text style={[es.chipText, isActive && es.chipTextActive]}>{PRAYER_LABEL[p]}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={es.label}>{t('minyans.date')}</Text>
            <Pressable style={es.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color={C.navy} strokeWidth={2} />
                <Text style={es.pickerText}>{dateStr}</Text>
              </View>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker value={dateObj} mode="date" minimumDate={new Date()}
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDateObj(d); }} />
            )}

            <Text style={es.label}>{t('minyans.time')}</Text>
            <Pressable style={es.pickerBtn} onPress={() => setShowTimePicker(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color={C.navy} strokeWidth={2} />
                <Text style={es.pickerText}>{timeStr}</Text>
              </View>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker value={timeObj} mode="time" is24Hour
                onChange={(_, ti) => { setShowTimePicker(false); if (ti) setTimeObj(ti); }} />
            )}

            <Text style={es.label}>{t('minyans.location')}</Text>
            <TextInput style={es.input} value={locationText} onChangeText={setLocationText}
              placeholderTextColor="#999" />

            <Text style={es.label}>{t('minyans.notesOptional')}</Text>
            <TextInput style={[es.input, { height: 70 }]} value={notes} onChangeText={setNotes}
              placeholderTextColor="#999" multiline />

            <TouchableOpacity style={es.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={es.saveBtnText}>{t('minyans.editBtn')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MinyanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, getValidToken, isAuthenticated } = useAuth();
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  const PRAYER_LABEL: Record<string, string> = {
    shacharit: t('minyans.shacharit'), mincha: t('minyans.mincha'),
    maariv: t('minyans.maariv'), musaf: t('minyans.musaf'), other: t('minyans.other'),
  };
  const [minyan, setMinyan]               = useState<MinyanDetail | null>(null);
  const [participants, setParticipants]   = useState<Participant[]>([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [editVisible, setEditVisible]     = useState(false);
  const socketRef                         = useRef<Socket | null>(null);

  const fetchParticipants = useCallback(async () => {
    try {
      const r = await client.get(`/minyans/${id}/participants`);
      setParticipants(r.data);
    } catch {}
  }, [id]);

  const fetchMinyan = useCallback(async () => {
    try {
      const detailRes = await client.get(`/minyans/${id}`);
      setMinyan(detailRes.data);
      if (isAuthenticated) {
        await fetchParticipants();
      } else {
        setParticipants([]);
      }
    } catch {
      Alert.alert(t('common.error'), t('minyans.loadError'));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [fetchParticipants, id, isAuthenticated, t]);

  useEffect(() => { void fetchMinyan(); }, [fetchMinyan]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    let socket: Socket;

    const connect = async () => {
      const token = await getValidToken();
      if (!token) return;

      socket = io(`${API_URL}/minyan`, { auth: { token }, transports: ['websocket'] });

      socket.on('connect', () => {
        socket.emit('minyan:watch', { minyanId: Number(id) });
      });

      socket.on('minyan:update', (data: { participantsCount: number; almostFull: boolean; isFull: boolean }) => {
        setMinyan((prev) => prev ? { ...prev, ...data } : prev);
        void fetchParticipants();
      });

      socketRef.current = socket;
    };

    void connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('minyan:unwatch', { minyanId: Number(id) });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchParticipants, getValidToken, id, isAuthenticated]);

  const requestRegistration = () => {
    requireAuth(() => { void handleRegister(); }, { reason: 'minyanJoin' });
  };

  const handleRegister = async () => {
    if (!minyan) return;
    try {
      setActionLoading(true);
      const res = await client.post(`/minyans/${id}/register`);
      setMinyan((prev) => prev ? { ...prev, isRegistered: true, participantsCount: res.data.participantsCount } : prev);
      void fetchParticipants();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.message ?? t('minyans.loadError'));
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
      void fetchParticipants();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.message ?? t('minyans.loadError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMinyan = () => {
    Alert.alert(t('minyans.cancelMinyanTitle'), t('minyans.cancelMinyanMsg'), [
      { text: t('minyans.keep'), style: 'cancel' },
      {
        text: t('minyans.cancelMinyan'), style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true);
            await client.delete(`/minyans/${id}`);
            Alert.alert(t('minyans.minyanCancelledTitle'), t('minyans.minyanCancelledMsg'));
            router.back();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('minyans.loadError'));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.gold} /></View>;
  }

  if (!minyan) return null;

  const cfg = getPrayerConfig(minyan.prayerType);
  const isCreator = minyan.creator?.id === user?.id;
  const count = minyan.participantsCount;
  const progressWidth = Math.min((count / 10) * 100, 100);
  const progressColor = minyan.isFull ? C.typeParve : minyan.almostFull ? C.kashrutGold : C.navy;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={C.navy} strokeWidth={2.5} />
        </Pressable>
        <HomeButton />
        <View style={[styles.headerIconRing, { backgroundColor: cfg.bg, borderColor: cfg.bg }]}>
          <cfg.Icon size={32} color={cfg.color} strokeWidth={2} />
        </View>
        <Text style={styles.headerTitle}>{PRAYER_LABEL[minyan.prayerType]}</Text>
        {minyan.destination && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <MapPin size={13} color={C.goldMuted} strokeWidth={2} />
            <Text style={styles.headerSub}>{minyan.destination.city}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Badges */}
        <View style={styles.badgeRow}>
          {minyan.isFull && (
            <View style={[styles.badge, styles.badgeFull]}>
              <Text style={[styles.badgeText, styles.badgeTextFull]}>{t('minyans.complete')}</Text>
            </View>
          )}
          {minyan.almostFull && !minyan.isFull && (
            <View style={[styles.badge, styles.badgeAlmost, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Flame size={12} color={C.kashrutGold} strokeWidth={2} />
              <Text style={[styles.badgeText, styles.badgeTextAlmost]}>{t('minyans.almostFull')}</Text>
            </View>
          )}
          {minyan.isRegistered && (
            <View style={[styles.badge, styles.badgeRegistered]}>
              <Text style={[styles.badgeText, styles.badgeTextRegistered]}>{t('minyans.youreRegistered')}</Text>
            </View>
          )}
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow icon={<Calendar size={18} color={C.goldMuted} strokeWidth={2} />} label={t('minyans.date')} value={formatDate(minyan.date)} />
          <InfoRow icon={<Clock size={18} color={C.goldMuted} strokeWidth={2} />} label={t('minyans.time')} value={minyan.time} />
          <InfoRow icon={<MapPin size={18} color={C.goldMuted} strokeWidth={2} />} label={t('minyans.location')} value={minyan.locationText} />
          {minyan.notes && <InfoRow icon={<FileText size={18} color={C.goldMuted} strokeWidth={2} />} label={t('minyans.notesLabel')} value={minyan.notes} />}
          {minyan.creator && (
            <InfoRow icon={<User size={18} color={C.goldMuted} strokeWidth={2} />} label={t('minyans.organiser')} value={`${minyan.creator.firstName} ${minyan.creator.lastName}`} />
          )}
        </View>

        {/* Participants */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('minyans.participants')}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` as any, backgroundColor: progressColor }]} />
          </View>
          <Text style={styles.progressLabel}>{count} / 10</Text>
          <Text style={styles.progressSub}>{t('minyans.requires10')}</Text>

          {participants.length > 0 ? (
            <View style={styles.participantsList}>
              {participants.map((p, i) => (
                <View key={p.id} style={styles.participantRow}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantAvatarText}>{p.firstName[0]}{p.lastName[0]}</Text>
                  </View>
                  <Text style={styles.participantName}>{p.firstName} {p.lastName}</Text>
                  {i === 0 && <Crown size={14} color="#E6A817" strokeWidth={2} />}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noParticipants}>{t('minyans.noParticipants')}</Text>
          )}
        </View>

        {/* Action buttons */}
        {!isCreator && (
          minyan.isRegistered ? (
            cancelConfirm ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>{t('minyans.cancelConfirmText')}</Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={styles.confirmKeepBtn} onPress={() => setCancelConfirm(false)}>
                    <Text style={styles.confirmKeepText}>{t('minyans.keep')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleCancel} disabled={actionLoading}>
                    {actionLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmCancelText}>{t('minyans.yesCancel')}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelConfirm(true)}>
                <Text style={styles.cancelBtnText}>{t('minyans.cancelRegistration')}</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.registerBtn, minyan.isFull && styles.registerBtnDisabled]}
              onPress={requestRegistration}
              disabled={actionLoading || minyan.isFull}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.registerBtnText}>
                    {minyan.isFull ? t('minyans.minyanFull') : t('minyans.joinBtn')}
                  </Text>}
            </TouchableOpacity>
          )
        )}

        {/* Chat button */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => requireAuth(
            () => router.push(`/minyan/chat/${id}?prayerType=${minyan.prayerType}&city=${minyan.destination?.city ?? ''}` as any),
            { reason: 'minyanChat' },
          )}
        >
          <MessageCircle size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.chatBtnText}>{t('minyans.chatBtn')}</Text>
        </TouchableOpacity>

        {isCreator && (
          <View style={{ gap: 10 }}>
            <View style={styles.creatorNote}>
              <Text style={styles.creatorNoteText}>{t('minyans.youCreated')}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)} disabled={actionLoading}>
              <Text style={styles.editBtnText}>{t('minyans.editTitle')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteMinyan} disabled={actionLoading}>
              {actionLoading
                ? <ActivityIndicator color="#e53935" size="small" />
                : <Text style={styles.deleteBtnText}>{t('minyans.cancelMinyan')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {isCreator && (
        <EditMinyanModal
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          minyan={minyan}
          onSaved={(updated) => setMinyan((prev) => prev ? { ...prev, ...updated } : prev)}
        />
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: C.cream },
  center:               { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:               {
    backgroundColor: C.cream,
    paddingTop: 60,
    paddingBottom: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  backBtn:              {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerIconRing:       { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1 },
  headerTitle:          { fontSize: 26, fontFamily: 'Inter-Black', fontWeight: '900', color: C.navy, marginBottom: 4, letterSpacing: -0.4 },
  headerSub:            { fontSize: 14, color: C.textSecondary },
  body:                 { padding: 16, gap: 14 },
  badgeRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeFull:            { backgroundColor: C.typeParveBg, borderColor: C.typeParveBg },
  badgeAlmost:          { backgroundColor: '#FBF6E9', borderColor: '#FBF6E9' },
  badgeRegistered:      { backgroundColor: C.goldFaint, borderColor: C.goldBorder },
  badgeText:            { fontSize: 13, fontFamily: 'Inter-Bold', fontWeight: '700' },
  badgeTextFull:        { color: C.typeParve },
  badgeTextAlmost:      { color: C.kashrutGold },
  badgeTextRegistered:  { color: C.navy },
  card:                 {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: C.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3EFE7',
  },
  cardTitle:            { fontSize: 14, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:              { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  infoIcon:             { width: 32, justifyContent: 'center', alignItems: 'center', paddingTop: 1 },
  infoContent:          { flex: 1 },
  infoLabel:            { fontSize: 12, color: C.textMuted, fontFamily: 'Inter-Bold', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue:            { fontSize: 15, color: C.textPrimary, marginTop: 2 },
  progressTrack:        { height: 12, backgroundColor: C.surface, borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
  progressFill:         { height: '100%', borderRadius: 6 },
  progressLabel:        { fontSize: 16, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy },
  progressSub:          { fontSize: 12, color: C.textMuted, marginTop: 2, marginBottom: 16 },
  participantsList:     { gap: 10, marginTop: 4 },
  participantRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  participantAvatar:    { width: 34, height: 34, borderRadius: 17, backgroundColor: C.goldFaint, justifyContent: 'center', alignItems: 'center' },
  participantAvatarText:{ fontSize: 12, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy },
  participantName:      { flex: 1, fontSize: 14, color: C.textPrimary, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  noParticipants:       { fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 12 },
  registerBtn:          { backgroundColor: C.navy, borderRadius: 14, padding: 18, alignItems: 'center' },
  registerBtnDisabled:  { backgroundColor: '#ccc' },
  registerBtnText:      { color: '#fff', fontSize: 17, fontFamily: 'Inter-Bold', fontWeight: '700' },
  cancelBtn:            { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#ffcccc' },
  cancelBtnText:        { color: '#e53935', fontSize: 16, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  confirmBox:           { backgroundColor: '#fff0f0', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#ffcccc' },
  confirmText:          { fontSize: 14, color: '#c00', textAlign: 'center', marginBottom: 12 },
  confirmRow:           { flexDirection: 'row', gap: 10 },
  confirmKeepBtn:       { flex: 1, padding: 12, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center' },
  confirmKeepText:      { fontSize: 15, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.navy },
  confirmCancelBtn:     { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#e53935', alignItems: 'center' },
  confirmCancelText:    { fontSize: 15, fontFamily: 'Inter-SemiBold', fontWeight: '600', color: '#fff' },
  creatorNote:          { backgroundColor: C.goldFaint, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.goldBorder },
  creatorNoteText:      { color: C.navy, fontSize: 14, fontFamily: 'Inter-Bold', fontWeight: '700' },
  chatBtn:              { backgroundColor: '#7A6B9D', borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  chatBtnText:          { color: '#fff', fontSize: 15, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  editBtn:              { backgroundColor: C.navy, borderRadius: 14, padding: 16, alignItems: 'center' },
  editBtnText:          { color: '#fff', fontSize: 15, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  deleteBtn:            { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ffcccc' },
  deleteBtnText:        { color: '#e53935', fontSize: 15, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
});

const es = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap:   { maxHeight: '90%' },
  sheet:       { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:       { fontSize: 20, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy },
  close:       { fontSize: 18, color: C.textMuted },
  label:       { fontSize: 13, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.navy, marginBottom: 6 },
  input:       { backgroundColor: C.cream, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: '#ECE7DE', color: C.textPrimary },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.cream, borderWidth: 1, borderColor: '#ECE7DE' },
  chipActive:  { backgroundColor: C.navy, borderColor: C.navy },
  chipText:    { fontSize: 13, color: C.textSecondary, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  pickerBtn:   { backgroundColor: C.cream, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#ECE7DE' },
  pickerText:  { fontSize: 15, color: C.textPrimary, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  saveBtn:     { backgroundColor: C.navy, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-Bold', fontWeight: '700' },
});
