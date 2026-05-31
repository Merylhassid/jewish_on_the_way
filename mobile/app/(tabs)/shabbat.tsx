import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { C } from '@/constants/theme';

interface ShabbatItem {
  title: string;
  date: string;
  category: string;
  hebrew?: string;
}

interface ShabbatData {
  location: { city: string; country: string };
  items: ShabbatItem[];
}

function parseTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function parseDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

const CATEGORY_ICON: Record<string, { icon: any; color: string; bg: string }> = {
  candles:   { icon: 'local-fire-department', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  havdalah:  { icon: 'nights-stay',           color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  parashat:  { icon: 'menu-book',             color: C.navy,    bg: 'rgba(10,35,66,0.10)'   },
  holiday:   { icon: 'celebration',           color: '#059669', bg: 'rgba(5,150,105,0.10)'  },
  roshHashana:{ icon: 'celebration',          color: '#059669', bg: 'rgba(5,150,105,0.10)'  },
};

const LABEL: Record<string, string> = {
  candles:  'הדלקת נרות',
  havdalah: 'הבדלה',
  parashat: 'פרשת השבוע',
  holiday:  'חג',
};

export default function ShabbatScreen() {
  const [data,    setData]    = useState<ShabbatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('נדרשת הרשאת מיקום');
        setLoading(false);
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = pos.coords;
        const url = `https://www.hebcal.com/shabbat?cfg=json&latitude=${latitude}&longitude=${longitude}&tzid=AUTO&M=on&b=18`;
        const res = await fetch(url);
        const json = await res.json();
        setData(json);
      } catch {
        setError('לא ניתן לטעון זמני שבת');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const candles  = data?.items.find(i => i.category === 'candles');
  const havdalah = data?.items.find(i => i.category === 'havdalah');
  const parasha  = data?.items.find(i => i.category === 'parashat');
  const holiday  = data?.items.find(i => i.category === 'holiday' || i.category === 'roshHashana');

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={s.subText}>מחשב זמנים לפי מיקומך…</Text>
    </View>
  );

  if (error) return (
    <View style={s.center}>
      <MaterialIcons name="error-outline" size={48} color={C.textMuted} />
      <Text style={s.subText}>{error}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerEmoji}>🕯️</Text>
        <View>
          <Text style={s.headerTitle}>זמני שבת</Text>
          {data?.location && (
            <Text style={s.headerSub}>{data.location.city}, {data.location.country}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* ── זמנים עיקריים ── */}
        <View style={s.mainRow}>
          {candles && (
            <View style={[s.mainCard, { borderTopColor: '#F59E0B' }]}>
              <MaterialIcons name="local-fire-department" size={28} color="#F59E0B" />
              <Text style={s.mainLabel}>הדלקת נרות</Text>
              <Text style={s.mainTime}>{parseTime(candles.date)}</Text>
              <Text style={s.mainDate}>{parseDate(candles.date)}</Text>
            </View>
          )}
          {havdalah && (
            <View style={[s.mainCard, { borderTopColor: '#6366F1' }]}>
              <MaterialIcons name="nights-stay" size={28} color="#6366F1" />
              <Text style={s.mainLabel}>הבדלה</Text>
              <Text style={s.mainTime}>{parseTime(havdalah.date)}</Text>
              <Text style={s.mainDate}>{parseDate(havdalah.date)}</Text>
            </View>
          )}
        </View>

        {/* ── פרשה / חג ── */}
        {parasha && (
          <View style={s.infoCard}>
            <MaterialIcons name="menu-book" size={20} color={C.navy} />
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>פרשת השבוע</Text>
              <Text style={s.infoValue}>{parasha.title}</Text>
              {parasha.hebrew && <Text style={s.infoHebrew}>{parasha.hebrew}</Text>}
            </View>
          </View>
        )}

        {holiday && (
          <View style={[s.infoCard, { borderLeftColor: '#059669' }]}>
            <MaterialIcons name="celebration" size={20} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={[s.infoLabel, { color: '#059669' }]}>חג</Text>
              <Text style={s.infoValue}>{holiday.title}</Text>
              {holiday.hebrew && <Text style={s.infoHebrew}>{holiday.hebrew}</Text>}
            </View>
          </View>
        )}

        <Text style={s.source}>מקור: HebCal • זמנים לפי 18 דקות לפני שקיעה</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  subText:{ fontSize: 14, color: C.textMuted, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.navy,
    paddingTop: 56, paddingBottom: 22, paddingHorizontal: 24,
  },
  headerEmoji: { fontSize: 36 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  body: { padding: 18, gap: 14 },

  mainRow: { flexDirection: 'row', gap: 12 },
  mainCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 18,
    padding: 18, alignItems: 'center', gap: 6,
    borderTopWidth: 4,
    shadowColor: C.navy, shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  mainLabel: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
  mainTime:  { fontSize: 30, fontWeight: '900', color: C.textPrimary, letterSpacing: -0.5 },
  mainDate:  { fontSize: 11, color: C.textMuted, textAlign: 'center' },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: C.navy,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  infoLabel:  { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 0.8, marginBottom: 2 },
  infoValue:  { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  infoHebrew: { fontSize: 14, color: C.textSecondary, marginTop: 2 },

  source: { fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 8 },
});
