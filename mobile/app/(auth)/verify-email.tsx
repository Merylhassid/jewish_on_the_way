import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/store/auth';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

const BG      = '#EAF1FF';
const P       = '#2468E8';
const INK     = '#0F172A';
const SUB     = '#64748B';
const LIN     = '#E8EEF8';
const GOLD    = C.gold;
const PIN_CLR = 'rgba(100,149,255,0.30)';
const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { email, returnTo } = useLocalSearchParams<{ email: string; returnTo?: string }>();
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
      router.replace({
        pathname: '/onboarding',
        params: returnTo ? { returnTo } : {},
      } as any);
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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.dash, { top: 88, left: -34, width: 205, transform: [{ rotate: '26deg' }] }]} />
        <View style={[s.dash, { top: 154, right: -24, width: 178, transform: [{ rotate: '-20deg' }] }]} />
        <View style={[s.pin, { top: 64, left: 38 }]} />
        <View style={[s.pin, { top: 48, right: 56, width: 18, height: 18 }]} />
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <View style={s.logoBlock}>
          <Image
            source={require('@/assets/images/logo.jpeg')}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.appName}>JEWISH ON THE WAY</Text>
        </View>

        <View style={s.sheet}>
          <Text style={s.sheetTitle}>{t('auth.verifyTitle')}</Text>
          <Text style={s.subtitle}>
            {t('auth.verifySubtitle')} <Text style={s.emailText}>{email}</Text>
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

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          {resent ? (
            <View style={s.successBox}>
              <Text style={s.successText}>{t('auth.resentCode')}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [s.btn, loading && s.btnDisabled, pressed && !loading && s.btnPressed]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>{t('auth.verifyBtn')}</Text>}
          </Pressable>

          <Pressable style={s.resendRow} onPress={handleResend} disabled={resending}>
            {resending
              ? <ActivityIndicator size="small" color={GOLD} />
              : <Text style={s.resendText}>{t('auth.resendCode')}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 72 : 54,
  },
  dash: {
    position: 'absolute',
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(100,149,255,0.28)',
  },
  pin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.6,
    borderColor: PIN_CLR,
  },
  logoBlock: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 28,
    marginBottom: 12,
  },
  appName: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: P,
    letterSpacing: 4.5,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 48,
    shadowColor: '#1a3a6b',
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 26,
    color: INK,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: SUB,
    marginBottom: 28,
    lineHeight: 21,
  },
  emailText: {
    fontFamily: 'Inter-SemiBold',
    color: INK,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  box: {
    width: 38,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: LIN,
    backgroundColor: '#F1F5FF',
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: INK,
  },
  boxFilled: {
    borderColor: P,
    backgroundColor: '#FFFFFF',
    shadowColor: P,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 12,
  },
  successText: {
    fontFamily: 'Inter-Regular',
    color: '#047857',
    fontSize: 13,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: P,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: P,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.68 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.984 }] },
  btnText: {
    fontFamily: 'Inter-Bold',
    color: '#fff',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  resendRow: {
    marginTop: 18,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontFamily: 'Inter-SemiBold',
    color: P,
    fontSize: 14,
  },
});
