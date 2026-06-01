import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import client from '@/src/api/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await client.post('/auth/forgot-password', { email: email.trim() });
      setMessage('If this email exists, a reset link has been sent.');
      setSuccess(true);
      setEmail('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter your email and we&apos;ll send you a reset link
      </Text>

      <TextInput
        style={[styles.input, (loading || success) && styles.inputDisabled]}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (success) setSuccess(false);
          if (error) setError('');
          if (message) setMessage('');
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading && !success}
      />

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.button, (loading || success) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading || success}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{success ? 'Sent' : 'Send Reset Link'}</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 28,
    paddingTop: 80,
  },
  back: { marginBottom: 32 },
  backText: { color: '#1a3a6b', fontSize: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a3a6b', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
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
  inputDisabled: {
    backgroundColor: '#f5f7fb',
  },
  button: {
    backgroundColor: '#1a3a6b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
    backgroundColor: '#1a3a6b',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successText: { color: '#116530', marginBottom: 12 },
  errorText: { color: '#a11', marginBottom: 12 },
});
