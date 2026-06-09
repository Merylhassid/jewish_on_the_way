import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NAVY = '#0B1736';
const GOLD = '#D4AF37';

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <Pressable onPress={toggle} style={styles.faqItem}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color="#BBC3D4"
        />
      </View>
      {open && <Text style={styles.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const faqs: { q: string; a: string }[] = t('about.faqs', { returnObjects: true }) as any;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="chevron-left" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('about.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* App description */}
        <View style={styles.descCard}>
          <View style={styles.logoBox}>
            <MaterialIcons name="synagogue" size={32} color={NAVY} />
          </View>
          <Text style={styles.appName}>Jewish On The Way</Text>
          <Text style={styles.descText}>{t('about.description')}</Text>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionLabel}>{t('about.faqTitle')}</Text>
        <View style={styles.card}>
          {faqs.map((item, i) => (
            <View key={i}>
              {i > 0 && <View style={styles.divider} />}
              <FaqItem question={item.q} answer={item.a} />
            </View>
          ))}
        </View>

        {/* Version */}
        <Text style={styles.version}>{t('about.version')} v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F8' },

  header: {
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: { width: 44, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  body: { padding: 20, paddingBottom: 48 },

  descCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(11,23,54,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 18, fontWeight: '700', color: NAVY, marginBottom: 8 },
  descText: { fontSize: 14, color: '#4B5563', lineHeight: 22, textAlign: 'center' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#8895A7',
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
    marginBottom: 24,
  },
  divider: { height: 1, backgroundColor: '#F0F2F8', marginHorizontal: 16 },

  faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: NAVY, marginRight: 8 },
  faqAnswer: { fontSize: 13, color: '#4B5563', lineHeight: 20, marginTop: 10 },

  version: { textAlign: 'center', fontSize: 12, color: '#9CA3AF' },
});
