import { router, useLocalSearchParams } from 'expo-router';
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
  View,
} from 'react-native';
import client from '@/src/api/client';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Determine if token came from URL (and should not be editable)
  const hasUrlToken = !!params.token;

  useEffect(() => {
    if (params.token) setToken(params.token);
  }, [params.token]);

  // Auto-navigate to login after 2 seconds on success
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const handleSubmit = async () => {
    // Clear any previous error
    setErrorMsg('');

    if (!token.trim()) {
      setErrorMsg('Please enter your reset token');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      await client.post('/auth/reset-password', {
        token: token.trim(),
        newPassword,
      });
      setShowSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Invalid or expired token';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {showSuccess ? (
          // Success Screen
          <View style={styles.centerContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Password Reset</Text>
            <Text style={styles.successMessage}>Your password has been reset successfully.</Text>
            <Text style={styles.successSubtitle}>Redirecting to login...</Text>
          </View>
        ) : (
          <>
            <Pressable style={styles.back} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>

            <Text style={styles.title}>New Password</Text>
            <Text style={styles.subtitle}>
              {hasUrlToken
                ? 'Choose a new password for your account.'
                : 'Enter the token from your email and choose a new password.'}
            </Text>

            {/* Token input only shown if no URL token (fallback mode) */}
            {!hasUrlToken && (
              <>
                <Text style={styles.label}>Reset Token</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Paste token from email"
                  placeholderTextColor="#999"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </>
            )}

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="New password (min 6 characters)"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!loading}
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Repeat new password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />

            {/* Error message display */}
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successIcon: {
    fontSize: 56,
    color: '#10b981',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  back: { marginBottom: 32 },
  backText: { color: '#1a3a6b', fontSize: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a3a6b', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#1a3a6b', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dde3f0',
    color: '#1a1a2e',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#1a3a6b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
