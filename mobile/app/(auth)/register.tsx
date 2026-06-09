import { Link, router } from 'expo-router';
import { useState } from 'react';
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
import { isValidEmail, passwordStrength, formatApiError } from '@/src/utils/validation';

import { C } from '@/constants/theme';
const GOLD = C.gold;
const NAVY = C.navy;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const pwStrength = password ? passwordStrength(password) : null;

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email || !password) { setError(t('auth.errFillAll')); return; }
    if (!isValidEmail(email)) { setError(t('auth.errValidEmail')); return; }
    if (password.length < 6) { setError(t('auth.errMinPassword')); return; }
    try {
      setError(null);
      setLoading(true);
      await register(email.trim(), password, firstName.trim(), lastName.trim());
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } } as any);
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
          <Text style={s.title}>{t('auth.createAccount')}</Text>
          <Text style={s.sub}>{t('auth.joinCommunity')}</Text>

          <View style={s.nameRow}>
            <View style={s.half}>
              <Text style={s.label}>{t('auth.firstName')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('auth.firstPlaceholder')}
                placeholderTextColor="#9AA8C0"
                value={firstName}
                onChangeText={t => { setFirstName(t); setError(null); }}
                autoCapitalize="words"
              />
            </View>
            <View style={s.half}>
              <Text style={s.label}>{t('auth.lastName')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('auth.lastPlaceholder')}
                placeholderTextColor="#9AA8C0"
                value={lastName}
                onChangeText={t => { setLastName(t); setError(null); }}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t('auth.email')}</Text>
            <TextInput
              style={s.inputFull}
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
              style={s.inputFull}
              placeholder={t('auth.minChars')}
              placeholderTextColor="#9AA8C0"
              value={password}
              onChangeText={t => { setPassword(t); setError(null); }}
              secureTextEntry
            />
            {pwStrength && (
              <View style={s.strengthRow}>
                {(['weak','medium','strong'] as const).map(level => (
                  <View key={level} style={[s.strengthBar, {
                    backgroundColor: pwStrength === 'weak' ? '#EF4444'
                      : pwStrength === 'medium' ? '#F59E0B' : '#22C55E',
                    opacity: pwStrength === 'weak' && level !== 'weak' ? 0.2
                      : pwStrength === 'medium' && level === 'strong' ? 0.2 : 1,
                  }]} />
                ))}
                <Text style={[s.strengthLabel, {
                  color: pwStrength === 'weak' ? '#EF4444' : pwStrength === 'medium' ? '#F59E0B' : '#22C55E',
                }]}>{pwStrength}</Text>
              </View>
            )}
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{t('auth.createBtn')}</Text>}
          </Pressable>

          <View style={s.footerRow}>
            <Text style={s.footerText}>{t('auth.alreadyAccount')}  </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable><Text style={s.footerLink}>{t('auth.signIn')}</Text></Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },

  hero: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 36,
    alignItems: 'center',
  },
  logoWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.35)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
  },
  logo: { width: 56, height: 56, borderRadius: 28 },
  brand: {
    fontFamily: 'Inter-Black',
    fontSize: 14, color: GOLD,
    letterSpacing: 3, textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
    marginTop: 7,
  },

  sheet: {
    flex: 1,
    backgroundColor: '#F4F6FC',
    borderTopLeftRadius: 34, borderTopRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 34, paddingBottom: 60,
  },
  title: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 26, color: '#0B1736', marginBottom: 4,
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14, color: '#6B7280', marginBottom: 28,
  },

  nameRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  half: { flex: 1 },
  field: { marginBottom: 4 },

  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 10, color: '#9CA3AF',
    letterSpacing: 1.2, marginBottom: 8, marginTop: 16,
  },
  input: {
    fontFamily: 'Inter-Regular',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 15,
    fontSize: 14, color: '#0B1736',
    borderWidth: 1.5, borderColor: '#E5EAF5',
  },
  inputFull: {
    fontFamily: 'Inter-Regular',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 15, color: '#0B1736',
    borderWidth: 1.5, borderColor: '#E5EAF5',
  },

  errorBox: {
    backgroundColor: '#FFF0F0', borderRadius: 12,
    padding: 14, marginTop: 12, marginBottom: 4,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    color: '#D93025', fontSize: 13, textAlign: 'center',
  },

  btn: {
    backgroundColor: NAVY,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 24, marginBottom: 16,
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.40)',
    shadowColor: NAVY, shadowOpacity: 0.28,
    shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  btnText: {
    fontFamily: 'Inter-Bold',
    color: '#fff', fontSize: 16, letterSpacing: 0.4,
  },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthBar:  { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontFamily: 'Inter-Medium', fontSize: 11, marginLeft: 4, textTransform: 'capitalize' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { fontFamily: 'Inter-Regular', color: '#6B7280', fontSize: 14 },
  footerLink: { fontFamily: 'Inter-Bold', color: NAVY, fontSize: 14 },
});
