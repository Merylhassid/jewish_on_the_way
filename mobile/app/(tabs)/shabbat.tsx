import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { BookOpen, Flame, Moon, Star } from 'lucide-react-native';
import { C } from '@/constants/theme';

interface ShabbatItem { title: string; date: string; category: string; hebrew?: string; }
interface ShabbatData { location: { city: string; country: string }; items: ShabbatItem[]; }

const toTime = (d: string) => new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const toDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function ShabbatScreen() {
  const [data,    setData]    = useState<ShabbatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission required'); setLoading(false); return; }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://www.hebcal.com/shabbat?cfg=json&latitude=${latitude}&longitude=${longitude}&tzid=AUTO&M=on&b=18`);
        setData(await res.json());
      } catch { setError('Could not load Shabbat times'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={s.centreText}>Detecting your location…</Text>
    </View>
  );

  if (error) return (
    <View style={s.center}>
      <Flame size={44} color="#E5E7EB" strokeWidth={1.5} />
      <Text style={s.centreText}>{error}</Text>
    </View>
  );

  const items    = Array.isArray(data?.items) ? data!.items : [];
  const candles  = items.find(i => i.category === 'candles');
  const havdalah = items.find(i => i.category === 'havdalah');
  const parasha  = items.find(i => i.category === 'parashat');
  const holiday  = items.find(i => i.category === 'holiday' || i.category === 'roshHashana');

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>SHABBAT TIMES</Text>
          <Text style={s.title}>Shabbat</Text>
          {data?.location && (
            <Text style={s.location}>{data.location.city}, {data.location.country}</Text>
          )}
        </View>
        <View style={s.headerIcon}>
          <Flame size={26} color={C.gold} strokeWidth={1.5} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.mainRow}>
          {candles && (
            <View style={[s.mainCard, { borderTopColor: C.gold }]}>
              <Flame size={28} color={C.gold} strokeWidth={1.5} />
              <Text style={s.mainLabel}>Candle Lighting</Text>
              <Text style={s.mainTime}>{toTime(candles.date)}</Text>
              <Text style={s.mainDate}>{toDate(candles.date)}</Text>
            </View>
          )}
          {havdalah && (
            <View style={[s.mainCard, { borderTopColor: '#6366F1' }]}>
              <Moon size={28} color="#6366F1" strokeWidth={1.5} />
              <Text style={s.mainLabel}>Havdalah</Text>
              <Text style={s.mainTime}>{toTime(havdalah.date)}</Text>
              <Text style={s.mainDate}>{toDate(havdalah.date)}</Text>
            </View>
          )}
        </View>

        {parasha && (
          <View style={s.infoCard}>
            <View style={[s.infoIcon, { backgroundColor: '#EFF6FF' }]}>
              <BookOpen size={18} color="#2563EB" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>PARASHA</Text>
              <Text style={s.infoValue}>{parasha.title}</Text>
              {parasha.hebrew && <Text style={s.infoHeb}>{parasha.hebrew}</Text>}
            </View>
          </View>
        )}

        {holiday && (
          <View style={s.infoCard}>
            <View style={[s.infoIcon, { backgroundColor: '#F0FDF4' }]}>
              <Star size={18} color="#16A34A" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.infoLabel, { color: '#16A34A' }]}>HOLIDAY</Text>
              <Text style={s.infoValue}>{holiday.title}</Text>
              {holiday.hebrew && <Text style={s.infoHeb}>{holiday.hebrew}</Text>}
            </View>
          </View>
        )}

        <Text style={s.source}>Source: HebCal  ·  18 minutes before sunset</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  centreText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.textSecondary, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20, paddingBottom: 18,
    backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  eyebrow:    { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 3 },
  title:      { fontFamily: 'Inter-Black', fontSize: 30, color: C.textPrimary, letterSpacing: -0.8 },
  location:   { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, marginTop: 3 },
  headerIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.goldFaint, borderWidth: 1, borderColor: C.goldBorder,
    justifyContent: 'center', alignItems: 'center',
  },

  body:     { padding: 20, gap: 14 },
  mainRow:  { flexDirection: 'row', gap: 12 },
  mainCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 20,
    padding: 18, alignItems: 'center', gap: 6, borderTopWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  mainLabel: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.textMuted, textAlign: 'center' },
  mainTime:  { fontFamily: 'Inter-Black', fontSize: 32, color: C.textPrimary, letterSpacing: -1 },
  mainDate:  { fontFamily: 'Inter-Regular', fontSize: 11, color: C.textMuted, textAlign: 'center' },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  infoIcon:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 3 },
  infoValue: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  infoHeb:   { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary, marginTop: 2 },

  source: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 4 },
});
