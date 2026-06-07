import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/store/auth';
import { isValidEmail, formatApiError } from '@/src/utils/validation';

import { C } from '@/constants/theme';
const GOLD = C.gold;
const NAVY = C.navy;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, token, loading: authLoading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && token) router.replace('/(tabs)');
  }, [token, authLoading]);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError(t('auth.errFillAll')); return; }
    if (!isValidEmail(email)) { setError(t('auth.errValidEmail')); return; }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setError(null);
      setLoading(true);
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.logoWrap}>
            <Image source={require('@/assets/images/logo.jpeg')} style={s.logo} />
          </View>
          <Text style={s.brand}>JEWISH ON THE WAY</Text>
          <Text style={s.tagline}>Your Jewish travel companion</Text>
        </View>

        {/* ── Form ── */}
        <View style={s.sheet}>
          <Text style={s.title}>{t('auth.welcomeBack')}</Text>
          <Text style={s.sub}>{t('auth.signInContinue')}</Text>

          <View style={s.field}>
            <Text style={s.label}>{t('auth.email')}</Text>
            <TextInput
              style={s.input}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#9AA8C0"
              value={email}
              onChangeText={t => { setEmail(t); setError(null); }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t('auth.password')}</Text>
            <TextInput
              style={s.input}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor="#9AA8C0"
              value={password}
              onChangeText={t => { setPassword(t); setError(null); }}
              secureTextEntry
            />
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{t('auth.signIn')}</Text>}
          </Pressable>

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={s.forgotRow}>
              <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
            </Pressable>
          </Link>

          <View style={s.footerRow}>
            <Text style={s.footerText}>{t('auth.noAccount')}  </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable><Text style={s.footerLink}>{t('auth.register')}</Text></Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },

  // ── Hero ──
  hero: {
    paddingTop: Platform.OS === 'ios' ? 90 : 70,
    paddingBottom: 42,
    alignItems: 'center',
  },
  logoWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.35)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  logo: { width: 62, height: 62, borderRadius: 31 },
  brand: {
    fontFamily: 'Inter-Black',
    fontSize: 15, color: GOLD,
    letterSpacing: 3, textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 13, color: 'rgba(255,255,255,0.45)',
    marginTop: 8,
  },

  // ── Sheet ──
  sheet: {
    flex: 1,
    backgroundColor: '#F4F6FC',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 60,
  },
  title: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 28, color: '#0B1736',
    marginBottom: 4,
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14, color: '#6B7280',
    marginBottom: 32,
  },

  // ── Inputs ──
  field:  { marginBottom: 20 },
  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 10, color: '#9CA3AF',
    letterSpacing: 1.2, marginBottom: 8,
  },
  input: {
    fontFamily: 'Inter-Regular',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 15, color: '#0B1736',
    borderWidth: 1.5, borderColor: '#E5EAF5',
  },

  errorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12, padding: 14,
    marginBottom: 16,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    color: '#D93025', fontSize: 13, textAlign: 'center',
  },

  // ── Button ──
  btn: {
    backgroundColor: NAVY,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.40)',
    shadowColor: NAVY, shadowOpacity: 0.28,
    shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  btnText: {
    fontFamily: 'Inter-Bold',
    color: '#fff', fontSize: 16, letterSpacing: 0.4,
  },

  forgotRow: { alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  forgotText: {
    fontFamily: 'Inter-SemiBold',
    color: NAVY, fontSize: 14,
  },

  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontFamily: 'Inter-Regular', color: '#6B7280', fontSize: 14 },
  footerLink: { fontFamily: 'Inter-Bold', color: NAVY, fontSize: 14 },
});
