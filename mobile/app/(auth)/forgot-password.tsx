import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import { isValidEmail, formatApiError } from '@/src/utils/validation';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async () => {
    if (!isValidEmail(email)) { setError(t('auth.errValidEmail')); return; }
    try {
      setLoading(true); setError('');
      await client.post('/auth/forgot-password', { email: email.trim() });
      setSuccess(true);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>{t('auth.back')}</Text>
          </Pressable>
          <Text style={s.brand}>JEWISH ON THE WAY</Text>
        </View>

        <View style={s.sheet}>
          <Text style={s.title}>{t('auth.resetTitle')}</Text>
          <Text style={s.sub}>{t('auth.resetSub')}</Text>

          <Text style={s.label}>{t('auth.email')}</Text>
          <TextInput
            style={[s.input, (loading || success) && { opacity: 0.6 }]}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor="#9AA8C0"
            value={email}
            onChangeText={v => { setEmail(v); setError(''); setSuccess(false); }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading && !success}
          />

          {success && (
            <View style={s.successBox}>
              <Text style={s.successText}>{t('auth.resetSentMsg')}</Text>
            </View>
          )}
          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <Pressable
            style={[s.btn, (loading || success) && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading || success}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{success ? t('auth.sent') : t('auth.sendReset')}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 36, paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 24 },
  backText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14, color: 'rgba(255,255,255,0.6)',
  },
  brand: {
    fontFamily: 'Inter-Black',
    fontSize: 13, color: C.gold,
    letterSpacing: 3,
  },
  sheet: {
    flex: 1, backgroundColor: '#F4F6FC',
    borderTopLeftRadius: 34, borderTopRightRadius: 34,
    paddingHorizontal: 26, paddingTop: 36, paddingBottom: 60,
  },
  title: { fontFamily: 'Inter-ExtraBold', fontSize: 26, color: C.navy, marginBottom: 6 },
  sub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: '#6B7280', marginBottom: 28 },
  label: { fontFamily: 'Inter-Bold', fontSize: 10, color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 8 },
  input: {
    fontFamily: 'Inter-Regular',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 15, color: C.navy,
    borderWidth: 1.5, borderColor: '#E5EAF5', marginBottom: 16,
  },
  successBox: {
    backgroundColor: '#ECFDF5', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  successText: { fontFamily: 'Inter-Medium', color: '#065F46', fontSize: 13 },
  errorText:   { fontFamily: 'Inter-Medium', color: C.error, fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: C.navy, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.40)',
    shadowColor: C.navy, shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  btnText: { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16, letterSpacing: 0.4 },
});
