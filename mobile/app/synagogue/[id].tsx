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
import HomeButton from '@/src/components/HomeButton';
import ReviewSection from '@/src/components/ReviewSection';
import ReportModal from '@/src/components/ReportModal';
import SuggestPlaceModal from '@/src/components/SuggestPlaceModal';
import FavoriteButton from '@/src/components/FavoriteButton';

const DENOM_DISPLAY: Record<string, { label: string; color: string }> = {
  ashkenaz: { label: 'אשכנז', color: '#3949AB' },
  sfarad:   { label: 'ספרד',  color: '#00897B' },
  chabad:   { label: 'חב"ד', color: '#E65100' },
  teimanim: { label: 'תימן',  color: '#558B2F' },
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
      } catch (error) {
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
        <ArrowLeft size={22} color="#fff" strokeWidth={2.5} />
      </Pressable>
      {showHome && <HomeButton />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.headerIconRing}>
          <Building2 size={28} color="#fff" strokeWidth={1.8} />
        </View>
        <Text style={styles.headerTitle}>Synagogue</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5E35B1" />
        </View>
      </View>
    );
  }

  if (!synagogue) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.center}>
          <Text style={styles.notFound}>Synagogue not found</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.name, { flex: 1 }]}>{synagogue.name}</Text>
          <FavoriteButton entityType="synagogue" entityId={synagogue.id} size={26} />
        </View>

        {/* Denomination */}
        {(() => {
          const key = getDenomKey(synagogue.denomination);
          const d = key ? DENOM_DISPLAY[key] : null;
          if (!synagogue.denomination) return null;
          return (
            <View style={[styles.denominationBadge, d ? { backgroundColor: d.color } : {}]}>
              <Text style={styles.denominationText}>
                {d ? `נוסח ${d.label}` : synagogue.denomination}
              </Text>
            </View>
          );
        })()}

        {/* About */}
        {aboutText && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.sectionValue}>{aboutText}</Text>
          </View>
        )}

        {/* Address */}
        {synagogue.address && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <MapPin size={13} color="#8A96B0" strokeWidth={2} />
              <Text style={styles.sectionLabel}>Address</Text>
            </View>
            <Text style={styles.sectionValue}>{synagogue.address}</Text>
          </View>
        )}

        {/* Operator */}
        {synagogue.operator && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Building2 size={13} color="#8A96B0" strokeWidth={2} />
              <Text style={styles.sectionLabel}>Operator</Text>
            </View>
            <Text style={styles.sectionValue}>{synagogue.operator}</Text>
          </View>
        )}

        {/* Opening Hours */}
        {synagogue.openingHours && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Clock size={13} color="#8A96B0" strokeWidth={2} />
              <Text style={styles.sectionLabel}>Hours</Text>
            </View>
            <Text style={styles.sectionValue}>{synagogue.openingHours}</Text>
          </View>
        )}

        {/* Contact Actions */}
        {(synagogue.phone || synagogue.website) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Contact</Text>
            <View style={styles.actions}>
              {synagogue.phone && (
                <Pressable style={styles.actionBtnLarge} onPress={() => handleCall(synagogue.phone!)}>
                  <View style={[styles.actionIconBox, { backgroundColor: 'rgba(5,150,105,0.10)' }]}>
                    <Phone size={20} color="#059669" strokeWidth={2} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Call</Text>
                    <Text style={styles.actionValue}>{synagogue.phone}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
                </Pressable>
              )}
              {synagogue.website && (
                <Pressable style={styles.actionBtnLarge} onPress={() => handleWebsite(synagogue.website!)}>
                  <View style={[styles.actionIconBox, { backgroundColor: 'rgba(94,53,177,0.10)' }]}>
                    <Globe size={20} color="#5E35B1" strokeWidth={2} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Visit Website</Text>
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
              <Text style={styles.mapButtonText}>View on Map</Text>
            </Pressable>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reviews</Text>
          <ReviewSection entityType="synagogue" entityId={Number(id)} />
        </View>

        {/* Report + Suggest */}
        <View style={styles.bottomActions}>
          <Pressable style={styles.ghostBtn} onPress={() => setReportVisible(true)}>
            <MaterialIcons name="flag" size={16} color="#DC2626" />
            <Text style={[styles.ghostBtnText, { color: '#DC2626' }]}>Report issue</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => setSuggestVisible(true)}>
            <MaterialIcons name="add-circle-outline" size={16} color="#5E35B1" />
            <Text style={[styles.ghostBtnText, { color: '#5E35B1' }]}>Suggest a place</Text>
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
  container: { flex: 1, backgroundColor: '#f8f6fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 15, color: '#999' },

  header: {
    backgroundColor: '#5E35B1',
    paddingTop: Platform.OS === 'ios' ? 60 : 42,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  backBtn: { alignSelf: 'flex-start' },
  headerIconRing: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },

  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },

  name: {
    fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 12,
  },

  denominationBadge: {
    backgroundColor: '#5E35B1',
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, alignSelf: 'flex-start', marginBottom: 20,
  },
  denominationText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  section: { marginBottom: 24 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8A96B0',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionValue: { fontSize: 15, color: '#1a1a1a', lineHeight: 22 },

  actions: { gap: 12 },
  actionBtnLarge: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, gap: 14,
  },
  actionIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  actionValue: { fontSize: 12, color: '#666', marginTop: 2 },

  mapButton: {
    flexDirection: 'row', backgroundColor: '#5E35B1',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 },
  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12,
    borderColor: 'rgba(0,0,0,0.10)', backgroundColor: '#fff',
  },
  ghostBtnText: { fontSize: 13, fontWeight: '700' },
});
