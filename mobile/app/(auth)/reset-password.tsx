import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import { formatApiError } from '@/src/utils/validation';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken]               = useState(params.token ?? '');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [loading, setLoading]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [showSuccess, setShowSuccess]   = useState(false);
  const hasUrlToken = !!params.token;

  useEffect(() => { if (params.token) setToken(params.token); }, [params.token]);
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => router.replace('/(auth)/login'), 2500);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!token.trim()) { setErrorMsg(t('auth.errFillAll')); return; }
    if (newPassword.length < 6) { setErrorMsg(t('auth.errMinPassword')); return; }
    if (newPassword !== confirmPassword) { setErrorMsg(t('auth.errNoMatch')); return; }
    try {
      setLoading(true);
      await client.post('/auth/reset-password', { token: token.trim(), newPassword });
      setShowSuccess(true);
    } catch (e) {
      setErrorMsg(formatApiError(e));
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
          {showSuccess ? (
            <View style={s.successScreen}>
              <View style={s.checkCircle}><Text style={s.checkIcon}>✓</Text></View>
              <Text style={s.successTitle}>{t('auth.passwordReset')}</Text>
              <Text style={s.successMsg}>{t('auth.resetSuccess')}</Text>
              <Text style={s.redirecting}>{t('auth.redirecting')}</Text>
            </View>
          ) : (
            <>
              <Text style={s.title}>{t('auth.newPasswordTitle')}</Text>
              <Text style={s.sub}>
                {hasUrlToken ? t('auth.newPasswordSub') : t('auth.newPasswordToken')}
              </Text>

              {!hasUrlToken && (
                <>
                  <Text style={s.label}>{t('auth.resetToken')}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Paste token from email"
                    placeholderTextColor="#9AA8C0"
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </>
              )}

              <Text style={s.label}>{t('auth.newPassword')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('auth.minChars')}
                placeholderTextColor="#9AA8C0"
                value={newPassword}
                onChangeText={v => { setNewPassword(v); setErrorMsg(''); }}
                secureTextEntry
                editable={!loading}
              />

              <Text style={s.label}>{t('auth.confirmPassword')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('auth.minChars')}
                placeholderTextColor="#9AA8C0"
                value={confirmPassword}
                onChangeText={v => { setConfirm(v); setErrorMsg(''); }}
                secureTextEntry
                editable={!loading}
              />

              {errorMsg ? (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Pressable style={s.btn} onPress={handleSubmit} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>{t('auth.resetBtn')}</Text>}
              </Pressable>
            </>
          )}
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
  backText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  brand:    { fontFamily: 'Inter-Black', fontSize: 13, color: C.gold, letterSpacing: 3 },
  sheet: {
    flex: 1, backgroundColor: '#F4F6FC',
    borderTopLeftRadius: 34, borderTopRightRadius: 34,
    paddingHorizontal: 26, paddingTop: 36, paddingBottom: 60,
  },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, borderWidth: 2, borderColor: '#10B981',
  },
  checkIcon:    { fontSize: 36, color: '#10B981' },
  successTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 24, color: C.navy, marginBottom: 10, textAlign: 'center' },
  successMsg:   { fontFamily: 'Inter-Regular', fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  redirecting:  { fontFamily: 'Inter-Regular', fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  title:  { fontFamily: 'Inter-ExtraBold', fontSize: 26, color: C.navy, marginBottom: 6 },
  sub:    { fontFamily: 'Inter-Regular', fontSize: 14, color: '#6B7280', marginBottom: 28 },
  label:  { fontFamily: 'Inter-Bold', fontSize: 10, color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 8 },
  input:  {
    fontFamily: 'Inter-Regular',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 15, color: C.navy,
    borderWidth: 1.5, borderColor: '#E5EAF5', marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontFamily: 'Inter-Medium', color: C.error, fontSize: 13 },
  btn: {
    backgroundColor: C.navy, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 8,
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.40)',
    shadowColor: C.navy, shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  btnText: { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16, letterSpacing: 0.4 },
});
