import { Link, router, useLocalSearchParams } from 'expo-router';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff, Lock, Mail, MapPin } from 'lucide-react-native';
import { useAuth } from '@/src/store/auth';
import { isValidEmail, formatApiError } from '@/src/utils/validation';
import { safeReturnTo } from '@/src/auth/auth-gates';

WebBrowser.maybeCompleteAuthSession();

const BG      = '#EAF1FF';
const P       = '#2468E8';
const INK     = '#0F172A';
const SUB     = '#64748B';
const MUT     = '#94A3B8';
const PIN_CLR = 'rgba(100,149,255,0.32)';
const ENABLE_GOOGLE_AUTH = false;
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, googleLogin, enterGuestMode, sessionMode } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const postAuthRoute = safeReturnTo(returnTo);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
    selectAccount: true,
  });

  useEffect(() => {
    if (sessionMode === 'authenticated') router.replace(postAuthRoute as any);
  }, [sessionMode, postAuthRoute]);

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError('Google login failed');
      return;
    }

    (async () => {
      try {
        setError(null);
        setGoogleLoading(true);
        await googleLogin(idToken);
        router.replace(postAuthRoute as any);
      } catch (e) {
        setError(formatApiError(e));
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleResponse, googleLogin, postAuthRoute]);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError(t('auth.errFillAll')); return; }
    if (!isValidEmail(email))       { setError(t('auth.errValidEmail')); return; }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setError(null); setLoading(true);
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      setError(null);
      await enterGuestMode();
      router.replace(postAuthRoute as any);
    } catch {
      setError(t('auth.guestModeError'));
    }
  };

  return (
    <View style={s.root}>

      {/* ── Decorative background ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.dash, { top: 80, left: -30, width: 200, transform: [{ rotate: '26deg' }] }]} />
        <View style={[s.dash, { top: 140, right: -20, width: 170, transform: [{ rotate: '-20deg' }] }]} />
        <View style={{ position: 'absolute', top: 58, left: 36 }}>
          <MapPin size={22} color={PIN_CLR} strokeWidth={1.8} />
        </View>
        <View style={{ position: 'absolute', top: 44, right: 52 }}>
          <MapPin size={28} color={PIN_CLR} strokeWidth={1.8} />
        </View>
        <View style={{ position: 'absolute', top: 130, left: 14 }}>
          <MapPin size={14} color={PIN_CLR} strokeWidth={1.8} />
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

            <Text style={s.sheetTitle}>{t('auth.signIn')}</Text>

            {/* Email */}
            <View style={s.fieldBlock}>
              <Text style={s.label}>{t('auth.email')}</Text>
              <View style={s.field}>
                <View style={s.iconWrap}><Mail size={16} color={MUT} strokeWidth={2} /></View>
                <TextInput
                  style={s.input}
                  placeholder={t('auth.emailPlaceholder')}
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
                <View style={s.iconWrap}><Lock size={16} color={MUT} strokeWidth={2} /></View>
                <TextInput
                  style={s.input}
                  placeholder={t('auth.passwordPlaceholder')}
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
            </View>

            {/* Forgot */}
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable style={s.forgot}>
                <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
              </Pressable>
            </Link>

            {/* Error */}
            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [s.btn, loading && s.btnDim, pressed && !loading && s.btnPressed]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnText}>{t('auth.signIn')}  →</Text>
              }
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.guestBtn, pressed && s.btnPressed]}
              onPress={handleGuest}
              disabled={loading || googleLoading}
            >
              <Text style={s.guestBtnText}>{t('auth.continueAsGuest')}</Text>
            </Pressable>

            {ENABLE_GOOGLE_AUTH && (
              <>
                {/* OR */}
                <View style={s.orRow}>
                  <View style={s.orLine} />
                  <Text style={s.orText}>{t('auth.or')}</Text>
                  <View style={s.orLine} />
                </View>

                <Pressable
                  style={({ pressed }) => [s.socialBtn, pressed && !googleLoading && s.btnPressed]}
                  onPress={() => {
                    if (!GOOGLE_CLIENT_ID) {
                      setError('Google login is not configured');
                      return;
                    }
                    void promptGoogle();
                  }}
                  disabled={!googleRequest || googleLoading}
                >
                  {googleLoading
                    ? <ActivityIndicator color={INK} size="small" />
                    : <Text style={s.socialBtnText}>Continue with Google</Text>}
                </Pressable>
              </>
            )}

            {/* Footer */}
            <View style={s.footer}>
              <Text style={s.footerMuted}>{t('auth.noAccount')}  </Text>
              <Link href={{ pathname: '/(auth)/register', params: returnTo ? { returnTo } : {} }} asChild>
                <Pressable><Text style={s.footerLink}>{t('auth.register')}</Text></Pressable>
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
    paddingTop: Platform.OS === 'ios' ? 72 : 54,
  },

  dash: {
    position: 'absolute',
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(100,149,255,0.28)',
  },

  // ── Logo — no card, directly on background ────────────────────────────────
  logoBlock: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  logo: {
    width: 116, height: 116,
    borderRadius: 28,
    marginBottom: 12,
  },
  appName: {
    fontFamily: 'Inter-Bold', fontSize: 11,
    color: P, letterSpacing: 4.5,
  },

  // ── White sheet ───────────────────────────────────────────────────────────
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 26,
    paddingTop: 30,
    paddingBottom: 48,
    shadowColor: '#1a3a6b',
    shadowOpacity: 0.10, shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 26, color: INK, letterSpacing: -0.5,
    marginBottom: 24,
  },

  fieldBlock: { marginBottom: 16 },
  label: {
    fontFamily: 'Inter-Bold', fontSize: 11,
    color: INK, letterSpacing: 1.3, marginBottom: 8,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5FF',
    borderRadius: 13, paddingHorizontal: 14,
  },
  iconWrap: { marginRight: 10 },
  input: {
    flex: 1, fontFamily: 'Inter-Regular',
    fontSize: 15, color: INK, paddingVertical: 14,
  },

  forgot:     { alignSelf: 'flex-end', marginTop: -4, marginBottom: 20 },
  forgotText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: P },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 14,
  },
  errorText: { fontFamily: 'Inter-Regular', color: '#DC2626', fontSize: 13 },

  btn: {
    backgroundColor: P,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: P,
    shadowOpacity: 0.38, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 7,
    marginBottom: 12,
  },
  btnDim:     { opacity: 0.68 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.984 }] },
  btnText:    { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16, letterSpacing: 0.3 },

  guestBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: P,
    backgroundColor: '#fff',
    marginBottom: 24,
  },
  guestBtnText: { fontFamily: 'Inter-Bold', color: P, fontSize: 15 },

  orRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E8EEF8' },
  orText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: MUT, marginHorizontal: 12, letterSpacing: 1.6 },

  socialBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8EEF8',
    backgroundColor: '#fff',
    marginBottom: 18,
  },
  socialBtnText: { fontFamily: 'Inter-Bold', color: INK, fontSize: 15 },

  footer:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerMuted:{ fontFamily: 'Inter-Regular', color: SUB, fontSize: 14 },
  footerLink: { fontFamily: 'Inter-Bold', color: P, fontSize: 14 },
});
