import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en';
import fr from './locales/fr';
import he from './locales/he';

export type Language = 'en' | 'fr' | 'he';
export const LANGUAGES: Language[] = ['en', 'fr', 'he'];
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'EN',
  fr: 'FR',
  he: 'עב',
};

// Initialize synchronously so useTranslation() works immediately on first render
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    he: { translation: he },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

// Restore persisted language choice (async, fires after init)
AsyncStorage.getItem('language').then((lang) => {
  if (lang && (LANGUAGES as string[]).includes(lang)) {
    i18n.changeLanguage(lang);
  }
});

export const setLanguage = async (lang: Language) => {
  await AsyncStorage.setItem('language', lang);
  i18n.changeLanguage(lang);
};

export default i18n;
