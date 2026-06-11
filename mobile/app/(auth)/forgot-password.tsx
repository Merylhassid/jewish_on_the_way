import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView,
  Image, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail, MapPin } from 'lucide-react-native';
import client from '@/src/api/client';
import { isValidEmail, formatApiError } from '@/src/utils/validation';

const BG      = '#EAF1FF';
const P       = '#2468E8';
const INK     = '#0F172A';
const SUB     = '#64748B';
const MUT     = '#94A3B8';
const PIN_CLR = 'rgba(100,149,255,0.30)';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

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
    <View style={s.root}>

      {/* ── Decorative background ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.dash, { top: 100, left: -30, width: 220, transform: [{ rotate: '28deg' }] }]} />
        <View style={[s.dash, { top: 175, right: -20, width: 190, transform: [{ rotate: '-22deg' }] }]} />
        <View style={{ position: 'absolute', top: 76, left: 44 }}>
          <MapPin size={24} color={PIN_CLR} strokeWidth={1.8} />
        </View>
        <View style={{ position: 'absolute', top: 58, right: 58 }}>
          <MapPin size={30} color={PIN_CLR} strokeWidth={1.8} />
        </View>
        <View style={{ position: 'absolute', top: 160, left: 18 }}>
          <MapPin size={16} color={PIN_CLR} strokeWidth={1.8} />
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

            {/* Back */}
            <Pressable style={s.back} onPress={() => router.back()}>
              <ArrowLeft size={18} color={INK} strokeWidth={2.5} />
              <Text style={s.backText}>{t('auth.back')}</Text>
            </Pressable>

            <Text style={s.sub}>{t('auth.resetSub')}</Text>

            {/* Email */}
            <View style={s.fieldBlock}>
              <Text style={s.label}>{t('auth.email')}</Text>
              <View style={[s.field, (loading || success) && s.fieldDim]}>
                <View style={s.iconWrap}><Mail size={16} color={MUT} strokeWidth={2} /></View>
                <TextInput
                  style={s.input}
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor={MUT}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); setSuccess(false); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading && !success}
                />
              </View>
            </View>

            {/* Success */}
            {success && (
              <View style={s.successBox}>
                <Text style={s.successText}>✓  {t('auth.resetSentMsg')}</Text>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA */}
            {!success && (
              <Pressable
                style={({ pressed }) => [s.btn, loading && s.btnDim, pressed && !loading && s.btnPressed]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>{t('auth.sendReset')}  →</Text>
                }
              </Pressable>
            )}

            <Pressable style={s.footer} onPress={() => router.back()}>
              <Text style={s.footerLink}>{t('auth.backToSignIn')}</Text>
            </Pressable>

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
    borderColor: 'rgba(100,149,255,0.26)',
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
  appName: { fontFamily: 'Inter-Bold', fontSize: 12, color: P, letterSpacing: 4.5 },

  // ── White sheet ───────────────────────────────────────────────────────────
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 48,
    shadowColor: '#1a3a6b',
    shadowOpacity: 0.10, shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },

  back: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20, alignSelf: 'flex-start',
  },
  backText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: INK, marginLeft: 6 },

  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14, color: SUB, lineHeight: 20,
    marginBottom: 24,
  },

  fieldBlock: { marginBottom: 16 },
  label: {
    fontFamily: 'Inter-Bold', fontSize: 11,
    color: INK, letterSpacing: 1.3,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5FF',
    borderRadius: 13, paddingHorizontal: 14,
  },
  fieldDim: { opacity: 0.55 },
  iconWrap: { marginRight: 10 },
  input: {
    flex: 1, fontFamily: 'Inter-Regular',
    fontSize: 15, color: INK,
    paddingVertical: 14,
  },

  successBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#A7F3D0',
    marginBottom: 14,
  },
  successText: { fontFamily: 'Inter-SemiBold', color: '#065F46', fontSize: 14 },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FECACA',
    marginBottom: 14,
  },
  errorText: { fontFamily: 'Inter-Regular', color: '#DC2626', fontSize: 13 },

  btn: {
    backgroundColor: P,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: P,
    shadowOpacity: 0.38, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 7,
    marginBottom: 24,
  },
  btnDim:     { opacity: 0.68 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.984 }] },
  btnText:    { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16, letterSpacing: 0.3 },

  footer:     { alignItems: 'center' },
  footerLink: { fontFamily: 'Inter-SemiBold', color: P, fontSize: 14 },
});
