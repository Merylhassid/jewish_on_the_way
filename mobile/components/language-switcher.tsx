import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, Language, setLanguage } from '@/src/i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language as Language;

  return (
    <View style={styles.row}>
      {LANGUAGES.map((lang, index) => (
        <Pressable
          key={lang}
          style={[
            styles.pill,
            index === 0 && styles.pillFirst,
            index === LANGUAGES.length - 1 && styles.pillLast,
            current === lang && styles.pillActive,
          ]}
          onPress={() => setLanguage(lang)}
        >
          <Text style={[styles.pillText, current === lang && styles.pillTextActive]}>
            {LANGUAGE_LABELS[lang]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#F2F5FB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E1E8F5',
    overflow: 'hidden',
  },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRightWidth: 1.5,
    borderRightColor: '#E1E8F5',
  },
  pillFirst: {},
  pillLast: { borderRightWidth: 0 },
  pillActive: { backgroundColor: '#0C2461' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#556080', letterSpacing: 0.4 },
  pillTextActive: { color: '#fff' },
});
