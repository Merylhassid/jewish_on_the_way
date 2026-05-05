import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import client, { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';
import { LanguageSwitcher } from '@/components/language-switcher';

const KASHRUT_VALUES = ['none', 'rabbinate', 'mehadrin', 'badatz'] as const;
type KashrutValue = typeof KASHRUT_VALUES[number];

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  onClose,
  initialFirst,
  initialLast,
  initialKashrut,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  initialFirst: string;
  initialLast: string;
  initialKashrut?: string | null;
  onSaved: (firstName: string, lastName: string, kashrutLevel: string) => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [kashrut, setKashrut] = useState(initialKashrut ?? 'none');
  const [loading, setLoading] = useState(false);

  const kashrutOptions = KASHRUT_VALUES.map((v) => ({
    value: v,
    label: t(`profile.kashrut.${v}` as any),
  }));

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
        kashrutLevel: kashrut,
      });
      onSaved(firstName.trim(), lastName.trim(), kashrut);
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
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

          <Text style={styles.inputLabel}>{t('profile.edit.kashrutLevel')}</Text>
          <View style={styles.kashrutRow}>
            {kashrutOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.kashrutChip, kashrut === opt.value && styles.kashrutChipActive]}
                onPress={() => setKashrut(opt.value)}
              >
                <Text style={[styles.kashrutChipText, kashrut === opt.value && styles.kashrutChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('profile.edit.save')}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setErrorMsg('Password must contain only English letters and numbers, and include at least one letter and one number');
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
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

          {/* Error message display */}
          {errorMsg && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Success message display */}
          {successMsg && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>✓ {successMsg}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && !loading && { opacity: 0.88 }]}
            onPress={handleSave}
            disabled={loading || !!successMsg}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('profile.password.update')}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const [editVisible, setEditVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      const token = await AsyncStorage.getItem('token');
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.avatarWrapper} onPress={handleChangeAvatar} disabled={avatarLoading}>
          {avatarLoading ? (
            <View style={styles.avatarRing}><ActivityIndicator color="#C9A84C" /></View>
          ) : user?.profileImageUrl ? (
            <View style={styles.avatarRing}>
              <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} contentFit="cover" />
            </View>
          ) : (
            <View style={[styles.avatarRing, styles.avatarInitialsRing]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.cameraPin}>
            <Text style={styles.cameraPinText}>📷</Text>
          </View>
        </Pressable>

        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.emailText}>{user?.email}</Text>

        {user?.kashrutLevel && user.kashrutLevel !== 'none' && (
          <View style={styles.kashrutBadge}>
            <Text style={styles.kashrutBadgeText}>
              🍽️ {user.kashrutLevel.charAt(0).toUpperCase() + user.kashrutLevel.slice(1)}
            </Text>
          </View>
        )}

        {user?.profileImageUrl && (
          <Pressable onPress={handleRemoveAvatar} style={styles.removePhotoBtn}>
            <Text style={styles.removePhotoText}>{t('profile.removePhoto')}</Text>
          </Pressable>
        )}
      </View>

      {/* ── Menu section ── */}
      <View style={styles.section}>
        <Pressable style={styles.row} onPress={() => setEditVisible(true)}>
          <View style={[styles.rowIconBox, { backgroundColor: '#EEF2FF' }]}>
            <Text style={styles.rowIconText}>👤</Text>
          </View>
          <Text style={styles.rowLabel}>{t('profile.editProfile')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable style={styles.row} onPress={() => setPasswordVisible(true)}>
          <View style={[styles.rowIconBox, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.rowIconText}>🔒</Text>
          </View>
          <Text style={styles.rowLabel}>{t('profile.changePassword')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <View style={styles.row}>
          <View style={[styles.rowIconBox, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.rowIconText}>🌐</Text>
          </View>
          <Text style={styles.rowLabel}>{t('profile.language')}</Text>
          <LanguageSwitcher />
        </View>
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

      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        initialFirst={user?.firstName ?? ''}
        initialLast={user?.lastName ?? ''}
        initialKashrut={user?.kashrutLevel}
        onSaved={(firstName, lastName, kashrutLevel) => updateUser({ firstName, lastName, kashrutLevel })}
      />
      <ChangePasswordModal visible={passwordVisible} onClose={() => setPasswordVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FB' },

  // ── Header ──
  header: {
    backgroundColor: '#0C2461',
    paddingTop: 72,
    paddingBottom: 36,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#C9A84C',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarInitialsRing: { backgroundColor: 'rgba(201,168,76,0.18)' },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#C9A84C' },
  cameraPin: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    backgroundColor: '#0C2461',
    borderRadius: 13,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  cameraPinText: { fontSize: 12 },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 5, letterSpacing: 0.2 },
  emailText: { fontSize: 13, color: 'rgba(255,255,255,0.52)' },
  kashrutBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(201,168,76,0.20)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.40)',
  },
  kashrutBadgeText: { color: '#C9A84C', fontSize: 12, fontWeight: '700' },
  removePhotoBtn: { marginTop: 12 },
  removePhotoText: { color: 'rgba(255,255,255,0.40)', fontSize: 12, textDecorationLine: 'underline' },

  // ── Section ──
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 20,
    shadowColor: '#0C2461',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  rowDivider: { height: 1, backgroundColor: '#F2F5FB', marginHorizontal: 18 },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowIconText: { fontSize: 18 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0C1A2E' },
  rowChevron: { fontSize: 20, color: '#B0BAC8', fontWeight: '500' },

  // ── Buttons ──
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    shadowColor: '#D93025',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  signOutText: { color: '#D93025', fontSize: 15, fontWeight: '700' },

  deleteLink: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteLinkText: { color: '#B0BAC8', fontSize: 13, textDecorationLine: 'underline' },

  deleteBox: {
    margin: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
  },
  deleteBoxText: { fontSize: 14, color: '#C62828', textAlign: 'center', marginBottom: 16, lineHeight: 21 },
  deleteBoxRow: { flexDirection: 'row', gap: 10 },
  deleteCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F2F5FB', alignItems: 'center' },
  deleteCancelText: { fontSize: 14, fontWeight: '700', color: '#0C2461' },
  deleteConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#D93025', alignItems: 'center' },
  deleteConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,36,97,0.45)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#DFE6F5',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
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
