import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import client, { API_URL } from '@/src/api/client';
import { getPrayerConfig } from '@/src/utils/prayerIcons';
import SuggestPlaceModal from '@/src/components/SuggestPlaceModal';
import SwipeableSheet from '@/src/components/SwipeableSheet';
import { useAuth } from '@/src/store/auth';
import { LanguageSwitcher } from '@/components/language-switcher';
import { C } from '@/constants/theme';

const KASHRUT_VALUES = ['none', 'rabbinate', 'mehadrin', 'badatz'] as const;
type KashrutValue = typeof KASHRUT_VALUES[number];

interface MyMinyan {
  id: number;
  prayerType: string;
  date: string;
  time: string;
  locationText: string;
  participantsCount: number;
  isFull: boolean;
  almostFull: boolean;
  isCreator: boolean;
  destination: { id: number; city: string } | null;
}
function fmtMinyanDate(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  onClose,
  initialFirst,
  initialLast,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  initialFirst: string;
  initialLast: string;
  onSaved: (firstName: string, lastName: string) => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(t('profile.alerts.error'), t('profile.errors.firstLastRequired'));
      return;
    }
    try {
      setLoading(true);
      await client.put('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      onSaved(firstName.trim(), lastName.trim());
      onClose();
      Alert.alert(t('profile.alerts.saved'), t('profile.alerts.profileUpdated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t('profile.errors.failedUpdate');
      Alert.alert(t('profile.alerts.error'), Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheetInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('profile.edit.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>{t('profile.edit.firstName')}</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('profile.edit.firstNamePlaceholder')}
            placeholderTextColor="#9AA8C0"
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>{t('profile.edit.lastName')}</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('profile.edit.lastNamePlaceholder')}
            placeholderTextColor="#9AA8C0"
            autoCapitalize="words"
          />

          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('profile.edit.save')}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password validation regex: at least 8 chars, at least one letter and one number, English only
  const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,}$/;

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSave = async () => {
    // Clear previous messages
    setErrorMsg('');
    setSuccessMsg('');

    // Validation
    if (!currentPassword) {
      setErrorMsg(t('profile.errors.enterCurrentPassword'));
      return;
    }
    if (!newPassword) {
      setErrorMsg(t('profile.password.newRequired') || 'New password is required');
      return;
    }
    if (!confirmPassword) {
      setErrorMsg(t('profile.password.confirmRequired') || 'Confirm password is required');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg(t('profile.pwMinLength'));
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setErrorMsg(t('profile.pwLetterAndNumber'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('profile.errors.passwordMismatch'));
      return;
    }

    try {
      setLoading(true);
      await client.put('/users/me/password', { currentPassword, newPassword });
      setSuccessMsg(t('profile.alerts.passwordUpdated') || 'Password updated successfully');
      
      // Auto-close after 1.5 seconds
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t('profile.errors.failedChangePassword');
      setErrorMsg(Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheetInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('profile.password.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>{t('profile.password.current')}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('profile.password.currentPlaceholder')}
            placeholderTextColor="#9AA8C0"
            secureTextEntry
            editable={!loading}
          />

          <Text style={styles.inputLabel}>{t('profile.password.new')}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('profile.password.newPlaceholder')}
            placeholderTextColor="#9AA8C0"
            secureTextEntry
            editable={!loading}
          />

          <Text style={styles.inputLabel}>{t('profile.password.confirm')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('profile.password.confirmPlaceholder')}
            placeholderTextColor="#9AA8C0"
            secureTextEntry
            editable={!loading}
          />

          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>✓ {successMsg}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && !loading && { opacity: 0.88 }]}
            onPress={handleSave}
            disabled={loading || !!successMsg}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('profile.password.update')}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const reset = () => {
    setSubject('');
    setMessage('');
    setErrorMsg('');
    setSent(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSend = async () => {
    setErrorMsg('');
    if (!subject.trim()) { setErrorMsg(t('contact.errors.subjectRequired')); return; }
    if (message.trim().length < 10) { setErrorMsg(t('contact.errors.messageTooShort')); return; }
    try {
      setLoading(true);
      await client.post('/contact', { subject: subject.trim(), message: message.trim() });
      setSent(true);
      setTimeout(() => { handleClose(); }, 2000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible={visible} onClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheetInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('contact.title')}</Text>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {/* Sender info */}
          <View style={contactStyles.senderBox}>
            <Text style={contactStyles.senderLabel}>{t('contact.sendingAs')}</Text>
            <Text style={contactStyles.senderName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={contactStyles.senderEmail}>{user?.email}</Text>
          </View>

          <Text style={styles.inputLabel}>{t('contact.subject')}</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('contact.subjectPlaceholder')}
            placeholderTextColor="#9AA8C0"
            maxLength={100}
            editable={!loading && !sent}
          />

          <Text style={styles.inputLabel}>{t('contact.message')}</Text>
          <TextInput
            style={[styles.input, contactStyles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder={t('contact.messagePlaceholder')}
            placeholderTextColor="#9AA8C0"
            multiline
            maxLength={2000}
            editable={!loading && !sent}
            textAlignVertical="top"
          />
          <Text style={contactStyles.charCount}>{message.length}/2000</Text>

          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {sent ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>✓ {t('contact.success')}</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && !loading && { opacity: 0.88 }]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>{t('contact.send')}</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout, updateUser, getValidToken } = useAuth();
  const [editVisible, setEditVisible]       = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [avatarLoading, setAvatarLoading]   = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(false);
  const [deleteLoading, setDeleteLoading]   = useState(false);
  const [suggestType, setSuggestType]       = useState<'restaurant' | 'synagogue'>('restaurant');
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [myMinyans,       setMyMinyans]       = useState<MyMinyan[]>([]);
  const [myOffers,        setMyOffers]        = useState<number>(0);
  const [myHostRequests,  setMyHostRequests]  = useState<number>(0);
  const [myNeeds,         setMyNeeds]         = useState<number>(0);

  useEffect(() => {
    client.get('/minyans/mine').then((res) => setMyMinyans(res.data)).catch(() => {});
    client.get('/hosting/offers/mine').then((res) => setMyOffers(Array.isArray(res.data) ? res.data.length : 0)).catch(() => {});
    client.get('/hosting/requests/mine').then((res) => setMyHostRequests(Array.isArray(res.data) ? res.data.length : 0)).catch(() => {});
    client.get('/hosting/needs/mine').then((res) => setMyNeeds(Array.isArray(res.data) ? res.data.length : 0)).catch(() => {});
  }, []);

  const handleLogout = async () => { await logout(); };

  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);
      await client.delete('/users/me');
      await logout();
      router.replace('/(auth)/login');
    } catch (err: any) {
      setDeleteLoading(false);
      setDeleteConfirm(false);
      const msg = err?.response?.data?.message ?? err?.message ?? t('profile.errors.failedDelete');
      Alert.alert(t('profile.alerts.error'), Array.isArray(msg) ? msg.join('\n') : String(msg));
    }
  };

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.errors.permissionRequired'), t('profile.errors.photoLibraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      type: asset.mimeType ?? 'image/jpeg',
      name: 'avatar.jpg',
    } as any);

    try {
      setAvatarLoading(true);
      const token = await getValidToken();
      // Use native fetch — React Native sets multipart boundary correctly, unlike axios
      const response = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message ?? `Upload failed (${response.status})`);
      }
      const data = await response.json();
      updateUser({ profileImageUrl: data.profileImageUrl });
    } catch (err: any) {
      Alert.alert(t('profile.errors.uploadFailed'), err.message ?? 'Something went wrong');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    Alert.alert(t('profile.alerts.removeAvatar'), t('profile.alerts.removeAvatarConfirm'), [
      { text: t('profile.alerts.cancel'), style: 'cancel' },
      {
        text: t('profile.alerts.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            setAvatarLoading(true);
            await client.delete('/users/me/avatar');
            updateUser({ profileImageUrl: null });
          } catch {
            Alert.alert(t('profile.alerts.error'), t('profile.errors.failedRemoveAvatar'));
          } finally {
            setAvatarLoading(false);
          }
        },
      },
    ]);
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 52 }} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Avatar */}
        <Pressable style={styles.avatarWrapper} onPress={handleChangeAvatar} disabled={avatarLoading}>
          {avatarLoading ? (
            <View style={styles.avatarRing}><ActivityIndicator color={GOLD} /></View>
          ) : user?.profileImageUrl ? (
            <View style={styles.avatarRing}>
              <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} contentFit="cover" />
            </View>
          ) : (
            <View style={[styles.avatarRing, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.cameraPin}>
            <MaterialIcons name="photo-camera" size={12} color={GOLD} />
          </View>
        </Pressable>

        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        {user?.kashrutLevel && user.kashrutLevel !== 'none' && (
          <View style={styles.kashrutBadge}>
            <Text style={styles.kashrutBadgeText}>
              {t(`profile.kashrut.${user.kashrutLevel}` as any)}
            </Text>
          </View>
        )}

        {user?.profileImageUrl && (
          <Pressable onPress={handleRemoveAvatar} style={styles.removePhotoBtn}>
            <Text style={styles.removePhotoText}>{t('profile.removePhoto')}</Text>
          </Pressable>
        )}
      </View>

      {/* ── Account section ── */}
      <Text style={styles.sectionEyebrow}>{t('profile.sectionAccount')}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => setEditVisible(true)}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(11,23,54,0.08)' }]}>
            <MaterialIcons name="person-outline" size={20} color={NAVY} />
          </View>
          <Text style={styles.rowLabel}>{t('profile.editProfile')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => setPasswordVisible(true)}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
            <MaterialIcons name="lock-outline" size={20} color={GOLD} />
          </View>
          <Text style={styles.rowLabel}>{t('profile.changePassword')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(74,158,108,0.12)' }]}>
            <MaterialIcons name="language" size={20} color="#4A9E6C" />
          </View>
          <Text style={styles.rowLabel}>{t('profile.language')}</Text>
          <LanguageSwitcher />
        </View>
      </View>

      {/* ── Contribute section ── */}
      <Text style={styles.sectionEyebrow}>{t('profile.sectionContribute')}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => { setSuggestType('restaurant'); setSuggestVisible(true); }}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(22,163,74,0.10)' }]}>
            <MaterialIcons name="restaurant" size={20} color="#16A34A" />
          </View>
          <Text style={styles.rowLabel}>{t('destination.suggestRestaurant')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => { setSuggestType('synagogue'); setSuggestVisible(true); }}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(124,58,237,0.10)' }]}>
            <MaterialIcons name="place" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.rowLabel}>{t('destination.suggestSynagogue')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
        </Pressable>
      </View>

      {/* ── My Minyans (hidden if user never created one) ── */}
      {myMinyans.length > 0 && (
        <>
          <Text style={styles.sectionEyebrow}>{t('profile.sectionMinyans')}</Text>
          <View style={styles.card}>
            {myMinyans.slice(0, 3).map((m, index) => (
              <View key={m.id}>
                {index > 0 && <View style={styles.divider} />}
                <Pressable style={styles.row} onPress={() => router.push(`/minyan/${m.id}` as any)}>
                  {(() => { const cfg = getPrayerConfig(m.prayerType); return (
                  <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
                    <cfg.Icon size={20} color={cfg.color} strokeWidth={2} />
                  </View>
                  ); })()}
                  <View style={styles.rowBody}>
                    <Text style={styles.minyanLabel}>{t(`minyans.${m.prayerType}` as any) || m.prayerType}</Text>
                    <Text style={styles.rowSub}>
                      {fmtMinyanDate(m.date)} · {m.time}{m.destination ? ` · ${m.destination.city}` : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
                </Pressable>
              </View>
            ))}
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={() => router.push('/minyans/my-minyans' as any)}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(79,70,229,0.08)' }]}>
                <MaterialIcons name="groups" size={20} color="#4F46E5" />
              </View>
              <Text style={[styles.rowLabel, { color: '#4F46E5' }]}>
                {t('minyans.seeAll')} ({myMinyans.length})
              </Text>
              <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
            </Pressable>
          </View>
        </>
      )}

      {/* ── My Hosting (hidden if no activity) ── */}
      {(myOffers > 0 || myHostRequests > 0 || myNeeds > 0) && (
        <>
          <Text style={styles.sectionEyebrow}>{t('profile.sectionHosting')}</Text>
          <View style={styles.card}>
            {myOffers > 0 && (
              <>
                <Pressable style={styles.row} onPress={() => router.push('/hosting/my-offers' as any)}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(22,163,74,0.10)' }]}>
                    <MaterialIcons name="home" size={20} color="#16A34A" />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{t('profile.myOffers')}</Text>
                    <Text style={styles.rowSub}>{myOffers} {t(myOffers === 1 ? 'profile.activeOffer' : 'profile.activeOffers')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
                </Pressable>
                {myHostRequests > 0 && <View style={styles.divider} />}
              </>
            )}
            {myHostRequests > 0 && (
              <>
                {(myNeeds > 0) && <View style={styles.divider} />}
                <Pressable style={styles.row} onPress={() => router.push('/hosting/my-requests' as any)}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
                    <MaterialIcons name="swap-horiz" size={20} color={GOLD} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{t('profile.myRequests')}</Text>
                    <Text style={styles.rowSub}>{myHostRequests} {t(myHostRequests === 1 ? 'profile.request' : 'profile.requests')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
                </Pressable>
              </>
            )}
            {myNeeds > 0 && (
              <>
                {(myOffers > 0 || myHostRequests > 0) && <View style={styles.divider} />}
                <Pressable style={styles.row} onPress={() => router.push('/hosting/my-needs' as any)}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(124,58,237,0.10)' }]}>
                    <MaterialIcons name="people-outline" size={20} color="#7C3AED" />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{t('profile.myPostedNeeds')}</Text>
                    <Text style={styles.rowSub}>{myNeeds} {t(myNeeds === 1 ? 'profile.openRequest' : 'profile.openRequests')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
                </Pressable>
              </>
            )}
          </View>
        </>
      )}

      {/* ── Admin section (admin only) ── */}
      {user?.role === 'admin' && (
        <>
          <Text style={styles.sectionEyebrow}>{t('profile.sectionAdmin')}</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => router.push('/admin' as any)}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(239,68,68,0.10)' }]}>
                <MaterialIcons name="admin-panel-settings" size={20} color="#EF4444" />
              </View>
              <Text style={styles.rowLabel}>{t('profile.controlPanel')}</Text>
              <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
            </Pressable>
          </View>
        </>
      )}

      {/* ── Support section ── */}
      <Text style={styles.sectionEyebrow}>{t('contact.section')}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => setContactVisible(true)}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(11,23,54,0.08)' }]}>
            <MaterialIcons name="headset-mic" size={20} color={NAVY} />
          </View>
          <Text style={styles.rowLabel}>{t('contact.title')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => router.push('/about' as any)}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
            <MaterialIcons name="info-outline" size={20} color={GOLD} />
          </View>
          <Text style={styles.rowLabel}>{t('about.title')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#BBC3D4" />
        </Pressable>
      </View>

      {/* ── Sign out ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.75}>
        <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>

      {/* ── Delete account ── */}
      {!deleteConfirm ? (
        <TouchableOpacity style={styles.deleteLink} onPress={() => setDeleteConfirm(true)} activeOpacity={0.6}>
          <Text style={styles.deleteLinkText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.deleteBox}>
          <Text style={styles.deleteBoxText}>{t('profile.deleteConfirm.text')}</Text>
          <View style={styles.deleteBoxRow}>
            <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeleteConfirm(false)}>
              <Text style={styles.deleteCancelText}>{t('profile.deleteConfirm.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete} disabled={deleteLoading}>
              {deleteLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.deleteConfirmText}>{t('profile.deleteConfirm.confirm')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SuggestPlaceModal
        visible={suggestVisible}
        onClose={() => setSuggestVisible(false)}
        entityType={suggestType}
      />

      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        initialFirst={user?.firstName ?? ''}
        initialLast={user?.lastName ?? ''}
        onSaved={(firstName, lastName) => updateUser({ firstName, lastName })}
      />
      <ChangePasswordModal visible={passwordVisible} onClose={() => setPasswordVisible(false)} />
      <ContactModal visible={contactVisible} onClose={() => setContactVisible(false)} />
    </ScrollView>
  );
}

const GOLD = C.gold;
const NAVY = C.navy;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FC' },

  // ── Header ──
  header: {
    backgroundColor: NAVY,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2.5, borderColor: GOLD,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarFallback: { backgroundColor: 'rgba(212,175,55,0.15)' },
  avatarImage:    { width: 95, height: 95, borderRadius: 47.5 },
  avatarInitials: {
    fontFamily: 'Inter-Bold', fontSize: 34, color: GOLD,
  },
  cameraPin: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: NAVY, borderRadius: 14,
    width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: GOLD,
  },
  name: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 22, color: '#fff', marginBottom: 4, letterSpacing: -0.3,
  },
  email: {
    fontFamily: 'Inter-Regular',
    fontSize: 13, color: 'rgba(255,255,255,0.45)',
  },
  kashrutBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
  },
  kashrutBadgeText: {
    fontFamily: 'Inter-SemiBold',
    color: GOLD, fontSize: 12, letterSpacing: 0.5,
  },
  removePhotoBtn: { marginTop: 10 },
  removePhotoText: {
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.35)', fontSize: 12, textDecorationLine: 'underline',
  },

  // ── Sections ──
  sectionEyebrow: {
    fontFamily: 'Inter-Bold',
    fontSize: 10, color: '#BBC3D4',
    letterSpacing: 1.8, marginLeft: 20, marginTop: 24, marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20, marginHorizontal: 16,
    shadowColor: NAVY, shadowOpacity: 0.06,
    shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16 },
  divider: { height: 1, backgroundColor: '#F4F6FC', marginHorizontal: 18 },
  iconBox: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15, color: '#111827',
  },
  rowBody:      { flex: 1 },
  rowSub:       { fontFamily: 'Inter-Regular', fontSize: 12, color: '#8A96B0', marginTop: 1 },
  minyanLabel:  { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#111827' },
  minyanEmoji:  { fontSize: 20 },

  // ── Buttons ──
  signOutBtn: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFCDD2',
  },
  signOutText: {
    fontFamily: 'Inter-Bold',
    color: '#D93025', fontSize: 15,
  },

  deleteLink: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteLinkText: {
    fontFamily: 'Inter-Regular',
    color: '#BBC3D4', fontSize: 13, textDecorationLine: 'underline',
  },

  deleteBox: {
    margin: 16, backgroundColor: '#FFF5F5',
    borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: '#FFCDD2',
  },
  deleteBoxText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14, color: '#C62828', textAlign: 'center', marginBottom: 16, lineHeight: 21,
  },
  deleteBoxRow: { flexDirection: 'row', gap: 10 },
  deleteCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F4F6FC', alignItems: 'center' },
  deleteCancelText: { fontFamily: 'Inter-Bold', fontSize: 14, color: NAVY },
  deleteConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#D93025', alignItems: 'center' },
  deleteConfirmText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#fff' },

  // ── Modals ──
  sheetInner: { paddingHorizontal: 24, paddingBottom: 44 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0C1A2E' },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F2F5FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 14, color: '#556080' },

  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#556080',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F2F5FB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: '#0C1A2E',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#E1E8F5',
  },
  primaryBtn: {
    backgroundColor: '#0C2461',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#0C2461',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  successContainer: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  successText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },

  kashrutRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
});

const contactStyles = StyleSheet.create({
  senderBox: {
    backgroundColor: '#F2F5FB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E1E8F5',
  },
  senderLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#9AA8C0',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  senderName:  { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#0C1A2E' },
  senderEmail: { fontFamily: 'Inter-Regular',  fontSize: 12, color: '#556080', marginTop: 1 },
  messageInput: { height: 130, paddingTop: 14 },
  charCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#9AA8C0',
    textAlign: 'right',
    marginTop: -12,
    marginBottom: 16,
  },
  kashrutChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2F5FB',
    borderWidth: 1.5,
    borderColor: '#E1E8F5',
  },
  kashrutChipActive: { backgroundColor: '#0C2461', borderColor: '#0C2461' },
  kashrutChipText: { fontSize: 13, color: '#556080', fontWeight: '500' },
  kashrutChipTextActive: { color: '#fff', fontWeight: '700' },
});
