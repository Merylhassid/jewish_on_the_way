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
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, Mail, MapPin, User } from 'lucide-react-native';
import { useAuth } from '@/src/store/auth';
import { isValidEmail, passwordStrength, formatApiError } from '@/src/utils/validation';
import { C } from '@/constants/theme';

const BG      = '#EAF1FF';
const P       = '#2468E8';
const INK     = '#0F172A';
const SUB     = '#64748B';
const MUT     = '#94A3B8';
const LIN     = '#E8EEF8';
const PIN_CLR = 'rgba(100,149,255,0.30)';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const pwStrength    = password ? passwordStrength(password) : null;
  const strengthBars  = pwStrength === 'weak' ? 1 : pwStrength === 'medium' ? 2 : 3;
  const strengthColor =
    pwStrength === 'weak' ? C.error : pwStrength === 'medium' ? C.warning : '#10B981';

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email || !password) {
      setError(t('auth.errFillAll')); return;
    }
    if (!isValidEmail(email)) { setError(t('auth.errValidEmail')); return; }
    if (password.length < 6)  { setError(t('auth.errMinPassword')); return; }
    try {
      setError(null); setLoading(true);
      await register(email.trim(), password, firstName.trim(), lastName.trim());
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } } as any);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>

      {/* ── Decorative background ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.dash, { top: 90, left: -28, width: 210, transform: [{ rotate: '26deg' }] }]} />
        <View style={[s.dash, { top: 158, right: -18, width: 180, transform: [{ rotate: '-20deg' }] }]} />
        <View style={{ position: 'absolute', top: 68, left: 40 }}>
          <MapPin size={22} color={PIN_CLR} strokeWidth={1.8} />
        </View>
        <View style={{ position: 'absolute', top: 52, right: 54 }}>
          <MapPin size={27} color={PIN_CLR} strokeWidth={1.8} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scroll}
        >

          {/* ── Logo — direct on background, no card ── */}
          <View style={s.logoBlock}>
            <Image
              source={require('@/assets/images/logo.jpeg')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.appName}>JEWISH ON THE WAY</Text>
          </View>

          {/* ── White sheet fills rest of screen ── */}
          <View style={s.sheet}>

            <Text style={s.sheetTitle}>{t('auth.createAccount')}</Text>

            {/* Name row */}
            <View style={s.nameRow}>
              <View style={[s.fieldBlock, { flex: 1, marginRight: 10 }]}>
                <Text style={s.label}>{t('auth.firstPlaceholder').toUpperCase()}</Text>
                <View style={s.field}>
                  <View style={s.iconWrap}><User size={14} color={MUT} strokeWidth={2} /></View>
                  <TextInput
                    style={s.input}
                    placeholder="David"
                    placeholderTextColor={MUT}
                    value={firstName}
                    onChangeText={v => { setFirstName(v); setError(null); }}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={[s.fieldBlock, { flex: 1 }]}>
                <Text style={s.label}>{t('auth.lastPlaceholder').toUpperCase()}</Text>
                <View style={s.field}>
                  <View style={s.iconWrap}><User size={14} color={MUT} strokeWidth={2} /></View>
                  <TextInput
                    style={s.input}
                    placeholder="Cohen"
                    placeholderTextColor={MUT}
                    value={lastName}
                    onChangeText={v => { setLastName(v); setError(null); }}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>

            {/* Email */}
            <View style={s.fieldBlock}>
              <Text style={s.label}>{t('auth.email')}</Text>
              <View style={s.field}>
                <View style={s.iconWrap}><Mail size={15} color={MUT} strokeWidth={2} /></View>
                <TextInput
                  style={s.input}
                  placeholder="david@example.com"
                  placeholderTextColor={MUT}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(null); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.fieldBlock}>
              <Text style={s.label}>{t('auth.password')}</Text>
              <View style={s.field}>
                <View style={s.iconWrap}><Lock size={15} color={MUT} strokeWidth={2} /></View>
                <TextInput
                  style={s.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={MUT}
                  value={password}
                  onChangeText={v => { setPassword(v); setError(null); }}
                  secureTextEntry={!showPw}
                />
                <TouchableOpacity onPress={() => setShowPw(p => !p)} hitSlop={8}>
                  {showPw
                    ? <EyeOff size={17} color={MUT} strokeWidth={2} />
                    : <Eye    size={17} color={MUT} strokeWidth={2} />}
                </TouchableOpacity>
              </View>
              {pwStrength && (
                <View style={s.strengthRow}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={[s.strengthSeg, { backgroundColor: i < strengthBars ? strengthColor : LIN }]} />
                  ))}
                  <Text style={[s.strengthLabel, { color: strengthColor }]}>{pwStrength}</Text>
                </View>
              )}
            </View>

            {/* Error */}
            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [s.btn, loading && s.btnDim, pressed && !loading && s.btnPressed]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnText}>{t('auth.createBtn')}  →</Text>
              }
            </Pressable>

            {/* Footer */}
            <View style={s.footer}>
              <Text style={s.footerMuted}>{t('auth.alreadyAccount')}  </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable><Text style={s.footerLink}>{t('auth.signIn')}</Text></Pressable>
              </Link>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 68 : 50,
  },

  dash: {
    position: 'absolute',
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(100,149,255,0.26)',
  },

  // ── Logo — no card, directly on background ────────────────────────────────
  logoBlock: {
    alignItems: 'center',
    paddingBottom: 22,
  },
  logo: {
    width: 108, height: 108,
    borderRadius: 26,
    marginBottom: 12,
  },
  appName: { fontFamily: 'Inter-Bold', fontSize: 11, color: P, letterSpacing: 4.5 },

  // ── White sheet ───────────────────────────────────────────────────────────
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 48,
    shadowColor: '#1a3a6b',
    shadowOpacity: 0.09, shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 24, color: INK, letterSpacing: -0.4,
    marginBottom: 20,
  },

  nameRow:    { flexDirection: 'row' },
  fieldBlock: { marginBottom: 13 },
  label: {
    fontFamily: 'Inter-Bold', fontSize: 11,
    color: INK, letterSpacing: 1.3,
    marginBottom: 7,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5FF',
    borderRadius: 12, paddingHorizontal: 12,
  },
  iconWrap: { marginRight: 9 },
  input: {
    flex: 1, fontFamily: 'Inter-Regular',
    fontSize: 15, color: INK,
    paddingVertical: 13,
  },

  strengthRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  strengthSeg:   { flex: 1, height: 3, borderRadius: 2, marginRight: 4 },
  strengthLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, textTransform: 'capitalize', minWidth: 42, textAlign: 'right' },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FECACA',
    marginBottom: 12,
  },
  errorText: { fontFamily: 'Inter-Regular', color: '#DC2626', fontSize: 13 },

  btn: {
    backgroundColor: P,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
    shadowColor: P,
    shadowOpacity: 0.36, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 7,
    marginBottom: 20,
  },
  btnDim:     { opacity: 0.68 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.984 }] },
  btnText:    { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16, letterSpacing: 0.3 },

  footer:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerMuted:{ fontFamily: 'Inter-Regular', color: SUB, fontSize: 14 },
  footerLink: { fontFamily: 'Inter-Bold', color: P, fontSize: 14 },
});
