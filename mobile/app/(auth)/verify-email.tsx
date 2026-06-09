import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/store/auth';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

const GOLD = C.gold;
const NAVY = C.navy;
const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { setSession } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [resent, setResent]     = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < CODE_LENGTH - 1) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) { setError(t('auth.errFillCode')); return; }
    try {
      setError(null);
      setLoading(true);
      const res = await client.post('/auth/verify-email', { email, code });
      await setSession(res.data.access_token, res.data.user);
      router.replace('/onboarding' as any);
    } catch (e: any) {
      setError(e?.response?.data?.message || t('auth.errInvalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      setResent(false);
      await client.post('/auth/resend-verification', { email });
      setResent(true);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.card}>
        <Text style={s.title}>{t('auth.verifyTitle')}</Text>
        <Text style={s.subtitle}>
          {t('auth.verifySubtitle')} {email}
        </Text>

        <View style={s.codeRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r; }}
              style={[s.box, d ? s.boxFilled : null]}
              value={d}
              onChangeText={v => handleChange(v, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {resent ? <Text style={s.success}>{t('auth.resentCode')}</Text> : null}

        <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={handleVerify} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{t('auth.verifyBtn')}</Text>}
        </Pressable>

        <Pressable style={s.resendRow} onPress={handleResend} disabled={resending}>
          {resending
            ? <ActivityIndicator size="small" color={GOLD} />
            : <Text style={s.resendText}>{t('auth.resendCode')}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: NAVY, justifyContent: 'center', padding: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center' },
  title:     { fontSize: 22, fontWeight: '700', color: NAVY, marginBottom: 10 },
  subtitle:  { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  codeRow:   { flexDirection: 'row', gap: 10, marginBottom: 20 },
  box:       { width: 44, height: 54, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', textAlign: 'center', fontSize: 24, fontWeight: '700', color: NAVY },
  boxFilled: { borderColor: GOLD },
  error:     { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  success:   { color: '#16a34a', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn:       { backgroundColor: NAVY, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 4, width: '100%', alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: GOLD, fontSize: 16, fontWeight: '700' },
  resendRow: { marginTop: 18, minHeight: 24, justifyContent: 'center' },
  resendText: { color: GOLD, fontSize: 14, fontWeight: '600' },
});
