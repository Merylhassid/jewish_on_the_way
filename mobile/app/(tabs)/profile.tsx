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
import client, { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';

// ─── Edit Profile Modal ─────────────────────────���───────────��─────────────────

const KASHRUT_OPTIONS = [
  { value: 'none',       label: 'None / Not specified' },
  { value: 'rabbinate',  label: '🟡 Rabbinate' },
  { value: 'mehadrin',   label: '🔵 Mehadrin' },
  { value: 'badatz',     label: '🟢 Badatz' },
];

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
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [kashrut, setKashrut] = useState(initialKashrut ?? 'none');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
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
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to update profile';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>Kashrut Level</Text>
          <View style={styles.kashrutRow}>
            {KASHRUT_OPTIONS.map((opt) => (
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

          <Pressable style={styles.primaryBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Change Password Modal ──────────────────────────────���─────────────────────

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); };

  const handleSave = async () => {
    if (!currentPassword) { Alert.alert('Error', 'Enter your current password'); return; }
    if (newPassword.length < 6) { Alert.alert('Error', 'New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'New passwords do not match'); return; }
    try {
      setLoading(true);
      await client.put('/users/me/password', { currentPassword, newPassword });
      Alert.alert('Success', 'Password updated successfully');
      reset();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to change password';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Current Password</Text>
          <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword}
            placeholder="Current password" placeholderTextColor="#999" secureTextEntry />

          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
            placeholder="New password (min 6 characters)" placeholderTextColor="#999" secureTextEntry />

          <Text style={styles.inputLabel}>Confirm New Password</Text>
          <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
            placeholder="Repeat new password" placeholderTextColor="#999" secureTextEntry />

          <Pressable style={styles.primaryBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Profile Screen ──────────────────────────��───────────────────────────

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [editVisible, setEditVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Sign Out ──
  const handleLogout = async () => {
    await logout();
  };

  // ── Delete Account (req 2.2.5) ──
  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);
      await client.delete('/users/me');
      await logout();
      router.replace('/(auth)/login');
    } catch (err: any) {
      setDeleteLoading(false);
      setDeleteConfirm(false);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to delete account';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
    }
  };

  // ── Avatar Upload — uses native fetch so React Native handles multipart boundary correctly ──
  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to change your avatar.');
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
      Alert.alert('Upload failed', err.message ?? 'Something went wrong');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    Alert.alert('Remove Avatar', 'Remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setAvatarLoading(true);
            await client.delete('/users/me/avatar');
            updateUser({ profileImageUrl: null });
          } catch {
            Alert.alert('Error', 'Failed to remove avatar');
          } finally {
            setAvatarLoading(false);
          }
        },
      },
    ]);
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.avatarWrapper} onPress={handleChangeAvatar} disabled={avatarLoading}>
          {avatarLoading ? (
            <View style={styles.avatar}><ActivityIndicator color="#1a3a6b" /></View>
          ) : user?.profileImageUrl ? (
            <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          )}
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>📷</Text>
          </View>
        </Pressable>

        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.kashrutLevel && user.kashrutLevel !== 'none' && (
          <View style={styles.kashrutBadge}>
            <Text style={styles.kashrutBadgeText}>
              🍽️ {user.kashrutLevel.charAt(0).toUpperCase() + user.kashrutLevel.slice(1)}
            </Text>
          </View>
        )}

        {user?.profileImageUrl && (
          <Pressable onPress={handleRemoveAvatar} style={styles.removeAvatarBtn}>
            <Text style={styles.removeAvatarText}>Remove photo</Text>
          </Pressable>
        )}
      </View>

      {/* ── Menu ── */}
      <View style={styles.section}>
        <Pressable style={styles.row} onPress={() => setEditVisible(true)}>
          <Text style={styles.rowIcon}>👤</Text>
          <Text style={styles.rowLabel}>Edit Profile</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => setPasswordVisible(true)}>
          <Text style={styles.rowIcon}>🔒</Text>
          <Text style={styles.rowLabel}>Change Password</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>
      </View>

      {/* ── Sign Out ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* ── Delete Account (req 2.2.5) ── */}
      {!deleteConfirm ? (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteConfirm(true)} activeOpacity={0.7}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.deleteConfirmBox}>
          <Text style={styles.deleteConfirmText}>Permanently delete your account?{'\n'}This cannot be undone.</Text>
          <View style={styles.deleteConfirmRow}>
            <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeleteConfirm(false)}>
              <Text style={styles.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete} disabled={deleteLoading}>
              {deleteLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.deleteConfirmBtnText}>Yes, Delete</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Modals ── */}
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
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: { backgroundColor: '#1a3a6b', paddingTop: 70, paddingBottom: 32, alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#a8c4e8', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#1a3a6b' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  avatarBadgeText: { fontSize: 14 },
  name: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: '#a8c4e8' },
  removeAvatarBtn: { marginTop: 10 },
  removeAvatarText: { color: '#ffaaaa', fontSize: 13 },
  section: { backgroundColor: '#fff', borderRadius: 16, margin: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4ff' },
  rowIcon: { fontSize: 20, marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 16, color: '#1a1a2e' },
  rowArrow: { fontSize: 20, color: '#bbb' },
  logoutBtn: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ffcccc' },
  logoutText: { color: '#e53935', fontSize: 16, fontWeight: '600' },
  deleteBtn: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, padding: 12, alignItems: 'center' },
  deleteText: { color: '#bbb', fontSize: 13, textDecorationLine: 'underline' },
  deleteConfirmBox: { margin: 16, backgroundColor: '#fff0f0', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#ffcccc' },
  deleteConfirmText: { fontSize: 14, color: '#c00', textAlign: 'center', marginBottom: 14, lineHeight: 20 },
  deleteConfirmRow: { flexDirection: 'row', gap: 10 },
  deleteCancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f0f4ff', alignItems: 'center' },
  deleteCancelText: { fontSize: 15, fontWeight: '600', color: '#1a3a6b' },
  deleteConfirmBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#e53935', alignItems: 'center' },
  deleteConfirmBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a3a6b' },
  modalClose: { fontSize: 18, color: '#999' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#1a3a6b', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14, borderWidth: 1, borderColor: '#dde3f0', color: '#1a1a2e' },
  primaryBtn: { backgroundColor: '#1a3a6b', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  kashrutBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  kashrutBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  kashrutRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  kashrutChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dde3f0' },
  kashrutChipActive: { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  kashrutChipText: { fontSize: 13, color: '#555' },
  kashrutChipTextActive: { color: '#fff', fontWeight: '600' },
});
