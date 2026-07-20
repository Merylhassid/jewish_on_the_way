import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ArrowLeft, Building2, Clock, Globe, Map, MapPin, Phone } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import HomeButton from '@/src/components/HomeButton';
import ReviewSection from '@/src/components/ReviewSection';
import ReportModal from '@/src/components/ReportModal';
import SuggestPlaceModal from '@/src/components/SuggestPlaceModal';
import FavoriteButton from '@/src/components/FavoriteButton';
import SynagogueIcon, { SYNAGOGUE_ICON_BG, SYNAGOGUE_ICON_COLOR } from '@/src/components/SynagogueIcon';
import { useRequireAuth } from '@/src/auth/auth-gates';
import { useTranslation } from 'react-i18next';

const DENOM_DISPLAY: Record<string, { color: string; bg: string }> = {
  ashkenaz: { color: '#5E6FA8', bg: '#F0F2FA' },
  sfarad:   { color: '#5F847D', bg: '#EEF5F3' },
  chabad:   { color: '#A06A4E', bg: '#F7F1EE' },
  teimanim: { color: '#6B8E6B', bg: '#EEF3EE' },
};

const ASHKENAZ_VALS = ['אשכנז', 'אשכנזי', 'ליטאי', 'ליטאית', 'ashkenaz', 'ashkenazi', 'orthodox'];
const SFARAD_VALS   = ['ספרד', 'ספרדי', 'ספרדית', 'עדות המזרח', 'מרוקאי', 'מרוקאית', 'הודי', 'בוכרה', 'אתיופי', 'טוניסאי', 'לובי', 'עיראקי', 'פרסי', 'sfarad', 'mizrahi'];
const CHABAD_VALS   = ['חב"ד', 'חבד', 'חסידי', 'חסידית', 'chabad', 'hasidic'];
const TEIMANIM_VALS = ['תימן', 'תימני', 'תימנית', 'שאמי', 'בלאדי', 'ירושלמי', 'teimanim', 'yemenite'];

function getDenomKey(denomination?: string | null): string | null {
  if (!denomination) return null;
  const d = denomination.toLowerCase();
  if (ASHKENAZ_VALS.some(v  => d.includes(v.toLowerCase()))) return 'ashkenaz';
  if (SFARAD_VALS.some(v    => d.includes(v.toLowerCase()))) return 'sfarad';
  if (CHABAD_VALS.some(v    => d.includes(v.toLowerCase()))) return 'chabad';
  if (TEIMANIM_VALS.some(v  => d.includes(v.toLowerCase()))) return 'teimanim';
  return null;
}

interface Synagogue {
  id: number;
  name: string;
  address?: string;
  description?: string;
  phone?: string;
  website?: string;
  denomination?: string;
  openingHours?: string;
  operator?: string;
  location?: { coordinates: [number, number] };
  destination?: { id: number; name: string };
}

export default function SynagogueDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const requireAuth = useRequireAuth();
  const [synagogue, setSynagogue] = useState<Synagogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [suggestVisible, setSuggestVisible] = useState(false);

  useEffect(() => {
    const fetchSynagogue = async () => {
      try {
        setLoading(true);
        const res = await client.get(`/synagogues/${id}`);
        setSynagogue(res.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSynagogue();
    }
  }, [id]);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleWebsite = (url: string) => {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    Linking.openURL(url).catch(() => {});
  };

  const handleMaps = (coords: [number, number]) => {
    const [lng, lat] = coords;
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  const HeaderBar = ({ showHome }: { showHome?: boolean }) => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={20} color={C.navy} strokeWidth={2.5} />
      </Pressable>
      {showHome && <HomeButton />}
      <View style={styles.headerBrand}>
        <View style={styles.headerIconRing}>
          <SynagogueIcon size={28} />
        </View>
        <View>
          <Text style={styles.headerEyebrow}>{t('synagogues.detailEyebrow')}</Text>
          <Text style={styles.headerTitle}>{t('synagogues.singular')}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      </View>
    );
  }

  if (!synagogue) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('synagogues.notFound')}</Text>
        </View>
      </View>
    );
  }

  const aboutText = synagogue?.description?.trim();

  return (
    <View style={styles.container}>
      <HeaderBar showHome />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name + Favorite */}
        <View style={styles.titleCard}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{synagogue.name}</Text>
            <FavoriteButton entityType="synagogue" entityId={synagogue.id} size={26} color={C.gold} />
          </View>
        </View>

        {/* Denomination */}
        {(() => {
          const key = getDenomKey(synagogue.denomination);
          const d = key ? DENOM_DISPLAY[key] : null;
          if (!synagogue.denomination) return null;
          return (
            <View style={[styles.denominationBadge, d ? { backgroundColor: d.bg, borderColor: d.bg } : {}]}>
              <Text style={[styles.denominationText, d ? { color: d.color } : {}]}>
                {d ? t('synagogues.riteLabel', { denomination: t(`synagogues.denominations.${key}`) }) : synagogue.denomination}
              </Text>
            </View>
          );
        })()}

        {/* About */}
        {aboutText && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('synagogues.about')}</Text>
            <Text style={styles.sectionValue}>{aboutText}</Text>
          </View>
        )}

        {/* Address */}
        {synagogue.address && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <MapPin size={13} color={C.goldMuted} strokeWidth={2} />
              <Text style={styles.sectionLabel}>{t('synagogues.address')}</Text>
            </View>
            <Text style={styles.sectionValue}>{synagogue.address}</Text>
          </View>
        )}

        {/* Operator */}
        {synagogue.operator && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Building2 size={13} color={C.goldMuted} strokeWidth={2} />
              <Text style={styles.sectionLabel}>{t('synagogues.operator')}</Text>
            </View>
            <Text style={styles.sectionValue}>{synagogue.operator}</Text>
          </View>
        )}

        {/* Opening Hours */}
        {synagogue.openingHours && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Clock size={13} color={C.goldMuted} strokeWidth={2} />
              <Text style={styles.sectionLabel}>{t('synagogues.hours')}</Text>
            </View>
            <Text style={styles.sectionValue}>{synagogue.openingHours}</Text>
          </View>
        )}

        {/* Contact Actions */}
        {(synagogue.phone || synagogue.website) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('synagogues.contact')}</Text>
            <View style={styles.actions}>
              {synagogue.phone && (
                <Pressable style={styles.actionBtnLarge} onPress={() => handleCall(synagogue.phone!)}>
                  <View style={[styles.actionIconBox, { backgroundColor: C.typeParveBg }]}>
                    <Phone size={20} color={C.typeParve} strokeWidth={2} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>{t('synagogues.call')}</Text>
                    <Text style={styles.actionValue}>{synagogue.phone}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
                </Pressable>
              )}
              {synagogue.website && (
                <Pressable style={styles.actionBtnLarge} onPress={() => handleWebsite(synagogue.website!)}>
                  <View style={[styles.actionIconBox, { backgroundColor: SYNAGOGUE_ICON_BG }]}>
                    <Globe size={20} color={SYNAGOGUE_ICON_COLOR} strokeWidth={2} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>{t('synagogues.visitWebsite')}</Text>
                    <Text style={styles.actionValue} numberOfLines={1}>{synagogue.website}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Location / Map */}
        {synagogue.location && (
          <View style={styles.section}>
            <Pressable style={styles.mapButton} onPress={() => handleMaps(synagogue.location!.coordinates)}>
              <Map size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.mapButtonText}>{t('synagogues.viewOnMap')}</Text>
            </Pressable>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('synagogues.reviews')}</Text>
          <ReviewSection entityType="synagogue" entityId={Number(id)} />
        </View>

        {/* Report + Suggest */}
        <View style={styles.bottomActions}>
          <Pressable
            style={styles.ghostBtn}
            onPress={() => requireAuth(() => setReportVisible(true), { reason: 'report' })}
          >
            <MaterialIcons name="flag" size={16} color="#DC2626" />
            <Text style={[styles.ghostBtnText, { color: '#DC2626' }]}>{t('synagogues.reportIssue')}</Text>
          </Pressable>
          <Pressable
            style={styles.ghostBtn}
            onPress={() => requireAuth(() => setSuggestVisible(true), { reason: 'suggestPlace' })}
          >
            <MaterialIcons name="add-circle-outline" size={16} color={SYNAGOGUE_ICON_COLOR} />
            <Text style={[styles.ghostBtnText, { color: SYNAGOGUE_ICON_COLOR }]}>{t('synagogues.suggestPlace')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        entityType="synagogue"
        entityId={synagogue.id}
        entityName={synagogue.name}
      />
      <SuggestPlaceModal
        visible={suggestVisible}
        onClose={() => setSuggestVisible(false)}
        entityType="synagogue"
        destinationId={synagogue.destination?.id ?? 0}
        destinationName={synagogue.destination?.name ?? ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 15, color: C.textMuted },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 60 : 42,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconRing: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: SYNAGOGUE_ICON_BG,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2F3',
  },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: 'Inter-ExtraBold', fontWeight: '800',
    color: C.goldEyebrow,
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter-Black', fontWeight: '900', color: C.navy, letterSpacing: -0.4 },

  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },

  titleCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3EFE7',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: {
    flex: 1,
    fontSize: 25,
    fontFamily: 'Inter-Black', fontWeight: '900',
    color: C.navy,
    letterSpacing: -0.3,
  },

  denominationBadge: {
    backgroundColor: SYNAGOGUE_ICON_BG,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 14, alignSelf: 'flex-start', marginBottom: 14,
    borderWidth: 1,
    borderColor: SYNAGOGUE_ICON_BG,
  },
  denominationText: { fontSize: 12, fontFamily: 'Inter-Bold', fontWeight: '700', color: SYNAGOGUE_ICON_COLOR },

  section: {
    marginBottom: 12,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3EFE7',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionValue: { fontSize: 15, color: C.textPrimary, lineHeight: 22 },

  actions: { gap: 12 },
  actionBtnLarge: {
    flexDirection: 'row', backgroundColor: C.card,
    borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3EFE7',
    gap: 14,
  },
  actionIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.textPrimary },
  actionValue: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  mapButton: {
    flexDirection: 'row', backgroundColor: C.navy,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapButtonText: { fontSize: 15, fontFamily: 'Inter-SemiBold', fontWeight: '600', color: '#fff' },

  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 },
  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12,
    borderColor: '#F0EDE6', backgroundColor: C.card,
  },
  ghostBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', fontWeight: '700' },
});
