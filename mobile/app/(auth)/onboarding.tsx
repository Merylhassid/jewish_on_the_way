import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { C } from '@/constants/theme';
import { setLanguage, Language, LANGUAGE_LABELS } from '@/src/i18n';
import { useAuth } from '@/src/store/auth';
import client from '@/src/api/client';

const KASHRUT_OPTIONS = ['none', 'rabbinate', 'mehadrin', 'badatz'] as const;

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();
  const [step,    setStep]    = useState<'lang' | 'kashrut'>('lang');
  const [kashrut, setKashrut] = useState('none');
  const [saving,  setSaving]  = useState(false);

  const selectLang = async (lang: Language) => {
    await setLanguage(lang);
    setStep('kashrut');
  };

  const finish = async () => {
    setSaving(true);
    try {
      await client.put('/users/me', { kashrutLevel: kashrut });
      updateUser({ kashrutLevel: kashrut });
    } catch {}
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} bounces={false}>
      {step === 'lang' ? (
        <>
          <Text style={s.brand}>JEWISH ON THE WAY</Text>
          <Text style={s.title}>Choose your language</Text>
          <Text style={s.sub}>You can change this anytime in your profile</Text>
          <View style={s.options}>
            {(['en', 'fr', 'he'] as Language[]).map(lang => (
              <Pressable
                key={lang}
                style={({ pressed }) => [s.optionCard, pressed && { opacity: 0.82 }]}
                onPress={() => selectLang(lang)}
              >
                <Text style={s.optionFlag}>
                  {lang === 'en' ? '🇬🇧' : lang === 'fr' ? '🇫🇷' : '🇮🇱'}
                </Text>
                <Text style={s.optionLabel}>
                  {lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : 'עברית'}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={s.brand}>JEWISH ON THE WAY</Text>
          <Text style={s.title}>{t('profile.edit.kashrutLevel')}</Text>
          <Text style={s.sub}>{"We'll use this to personalize your experience"}</Text>
          <View style={s.chips}>
            {KASHRUT_OPTIONS.map(k => (
              <Pressable
                key={k}
                style={[s.chip, kashrut === k && s.chipActive]}
                onPress={() => setKashrut(k)}
              >
                <Text style={[s.chipText, kashrut === k && s.chipTextActive]}>
                  {t(`profile.kashrut.${k}` as any)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]}
            onPress={finish}
            disabled={saving}
          >
            <Text style={s.btnText}>Get Started →</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.navy },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32, paddingTop: Platform.OS === 'ios' ? 80 : 60 },
  brand:   { fontFamily: 'Inter-Black', fontSize: 12, color: C.gold, letterSpacing: 3, marginBottom: 40 },
  title:   { fontFamily: 'Inter-ExtraBold', fontSize: 28, color: '#fff', textAlign: 'center', marginBottom: 8 },
  sub:     { fontFamily: 'Inter-Regular', fontSize: 14, color: 'rgba(255,255,255,0.50)', textAlign: 'center', marginBottom: 40 },
  options: { width: '100%', gap: 14 },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  optionFlag:  { fontSize: 32 },
  optionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: '#fff' },
  chips:   { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 40 },
  chip:    { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipActive:     { borderColor: C.gold, backgroundColor: 'rgba(212,175,55,0.15)' },
  chipText:       { fontFamily: 'Inter-Medium', fontSize: 14, color: 'rgba(255,255,255,0.65)' },
  chipTextActive: { color: C.gold, fontFamily: 'Inter-SemiBold' },
  btn: {
    width: '100%', backgroundColor: C.gold, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  btnText: { fontFamily: 'Inter-Bold', color: C.navy, fontSize: 16 },
});
