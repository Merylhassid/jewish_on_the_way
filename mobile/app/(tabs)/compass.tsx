import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const JERUSALEM = { lat: 31.7767, lng: 35.2345 };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function calcBearing(lat1: number, lng1: number): number {
  const dL = toRad(JERUSALEM.lng - lng1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(JERUSALEM.lat);
  const x = Math.sin(dL) * Math.cos(φ2);
  const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dL);
  return ((toDeg(Math.atan2(x, y)) + 360) % 360);
}

function calcDistance(lat1: number, lng1: number): number {
  const R = 6371;
  const dLat = toRad(JERUSALEM.lat - lat1);
  const dLng = toRad(JERUSALEM.lng - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(JERUSALEM.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shortestAngle(prev: number, next: number): number {
  let diff = ((next - prev) % 360 + 360) % 360;
  if (diff > 180) diff -= 360;
  return prev + diff;
}

const COMPASS_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function headingLabel(deg: number) {
  return COMPASS_DIRS[Math.round(deg / 22.5) % 16];
}

const DISC_LABELS: { label: string; angle: number; isCardinal: boolean }[] = [
  { label: 'N', angle: 0,   isCardinal: true  },
  { label: 'NE', angle: 45,  isCardinal: false },
  { label: 'E', angle: 90,  isCardinal: true  },
  { label: 'SE', angle: 135, isCardinal: false },
  { label: 'S', angle: 180, isCardinal: true  },
  { label: 'SW', angle: 225, isCardinal: false },
  { label: 'W', angle: 270, isCardinal: true  },
  { label: 'NW', angle: 315, isCardinal: false },
];

const DISC_SIZE   = 260;
const DISC_RADIUS = DISC_SIZE / 2;
const LABEL_RADIUS = DISC_RADIUS - 26;
const NEEDLE_LEN  = 88;

export default function CompassScreen() {
  const { t } = useTranslation();
  const [permStatus, setPermStatus]   = useState<'unknown' | 'denied' | 'granted'>('unknown');
  const [location, setLocation]       = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading]         = useState(0);
  const [bearing, setBearing]         = useState<number | null>(null);
  const [distance, setDistance]       = useState<number | null>(null);

  const discAnim   = useRef(new Animated.Value(0)).current;
  const needleAnim = useRef(new Animated.Value(0)).current;
  const prevDisc   = useRef(0);
  const prevNeedle = useRef(0);
  const latestBearing = useRef<number | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPermStatus('denied'); return; }
      setPermStatus('granted');

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocation({ lat, lng });

      const b = calcBearing(lat, lng);
      latestBearing.current = b;
      setBearing(b);
      setDistance(calcDistance(lat, lng));

      sub = await Location.watchHeadingAsync((h) => {
        const mag = h.magHeading ?? h.trueHeading ?? 0;
        setHeading(mag);

        const nextDisc = shortestAngle(prevDisc.current, -mag);
        prevDisc.current = nextDisc;
        Animated.spring(discAnim, { toValue: nextDisc, speed: 20, bounciness: 2, useNativeDriver: true }).start();

        const bear = latestBearing.current ?? 0;
        const nextNeedle = shortestAngle(prevNeedle.current, bear - mag);
        prevNeedle.current = nextNeedle;
        Animated.spring(needleAnim, { toValue: nextNeedle, speed: 20, bounciness: 2, useNativeDriver: true }).start();
      });
    })();

    return () => { sub?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bearing === null) return;
    latestBearing.current = bearing;
    const nextNeedle = shortestAngle(prevNeedle.current, bearing - heading);
    prevNeedle.current = nextNeedle;
    Animated.spring(needleAnim, { toValue: nextNeedle, speed: 20, bounciness: 2, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearing]);

  const discRotate   = discAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });
  const needleRotate = needleAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });

  // ── Permission denied ──
  if (permStatus === 'denied') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>✡</Text>
          <Text style={styles.headerTitle}>{t('compass.title')}</Text>
        </View>
        <View style={styles.stateBox}>
          <Text style={styles.stateEmoji}>📍</Text>
          <Text style={styles.stateTitle}>{t('compass.permTitle')}</Text>
          <Text style={styles.stateSub}>{t('compass.permSub')}</Text>
        </View>
      </View>
    );
  }

  // ── Loading ──
  if (permStatus === 'unknown' || !location) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>✡</Text>
          <Text style={styles.headerTitle}>{t('compass.title')}</Text>
        </View>
        <View style={styles.stateBox}>
          <Text style={styles.stateEmoji}>🧭</Text>
          <Text style={styles.loadingText}>{t('compass.acquiring')}</Text>
        </View>
      </View>
    );
  }

  // ── Main ──
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>✡</Text>
        <Text style={styles.headerTitle}>{t('compass.title')}</Text>
        <Text style={styles.headerSub}>{t('compass.subtitle')}</Text>
      </View>

      {/* Compass */}
      <View style={styles.compassOuter}>
        <View style={styles.discBackground} />

        <Animated.View style={[styles.disc, { transform: [{ rotate: discRotate }] }]}>
          <View style={styles.tickRing} />
          {DISC_LABELS.map(({ label, angle, isCardinal }) => {
            const rad = toRad(angle - 90);
            return (
              <Text
                key={label}
                style={[
                  styles.dirLabel,
                  isCardinal ? styles.dirLabelCardinal : styles.dirLabelOrdinal,
                  label === 'N' && styles.dirLabelN,
                  {
                    position: 'absolute',
                    left: DISC_RADIUS + LABEL_RADIUS * Math.cos(rad) - (isCardinal ? 8 : 10),
                    top:  DISC_RADIUS + LABEL_RADIUS * Math.sin(rad) - (isCardinal ? 10 : 8),
                  },
                ]}
              >
                {label}
              </Text>
            );
          })}
        </Animated.View>

        <Animated.View
          style={[styles.needleContainer, { transform: [{ rotate: needleRotate }] }]}
          pointerEvents="none"
        >
          <Text style={styles.starIcon}>✡</Text>
          <View style={styles.tipJerusalem} />
          <View style={styles.tipSouth} />
        </Animated.View>

        <View style={styles.centerPin} />
      </View>

      {/* Info strip */}
      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoVal}>{bearing !== null ? `${Math.round(bearing)}°` : '—'}</Text>
          <Text style={styles.infoLbl}>{t('compass.bearing')}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoVal}>
            {distance !== null
              ? distance >= 1000
                ? `${Math.round(distance / 100) / 10}k km`
                : `${Math.round(distance)} km`
              : '—'}
          </Text>
          <Text style={styles.infoLbl}>{t('compass.distance')}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoVal}>{Math.round(heading)}°</Text>
          <Text style={styles.infoLbl}>{headingLabel(heading)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLine}>{t('compass.goldNeedle')}</Text>
        <Text style={styles.footerLine}>{t('compass.discRotates')}</Text>
        <Text style={styles.footerCoords}>{t('compass.coords')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FB' },

  header: {
    backgroundColor: '#0C2461',
    paddingTop: 64,
    paddingBottom: 26,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerIcon:  { fontSize: 26, color: '#C9A84C', marginBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4, letterSpacing: 0.2 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.52)' },

  stateBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36 },
  stateEmoji: { fontSize: 52, marginBottom: 18 },
  stateTitle: { fontSize: 20, fontWeight: '700', color: '#0C2461', marginBottom: 10, textAlign: 'center' },
  stateSub:   { fontSize: 14, color: '#556080', textAlign: 'center', lineHeight: 22 },
  loadingText:{ fontSize: 16, color: '#556080', fontWeight: '500' },

  compassOuter: {
    alignSelf: 'center',
    marginTop: 28,
    width: DISC_SIZE,
    height: DISC_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discBackground: {
    position: 'absolute',
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_RADIUS,
    backgroundColor: '#fff',
    shadowColor: '#0C2461',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
  disc: {
    position: 'absolute',
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickRing: {
    position: 'absolute',
    width: DISC_SIZE - 8,
    height: DISC_SIZE - 8,
    borderRadius: (DISC_SIZE - 8) / 2,
    borderWidth: 1.5,
    borderColor: '#DFE6F5',
  },
  dirLabel: { fontWeight: '700', textAlign: 'center' },
  dirLabelCardinal: { fontSize: 15, color: '#4A5B7A', width: 16 },
  dirLabelOrdinal:  { fontSize: 11, color: '#9AAAC0', width: 20 },
  dirLabelN:        { color: '#0C2461', fontSize: 17 },

  needleContainer: {
    position: 'absolute',
    width: 32,
    alignItems: 'center',
    zIndex: 8,
  },
  starIcon: { fontSize: 15, color: '#C9A84C', marginBottom: 2 },
  tipJerusalem: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: NEEDLE_LEN,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#C9A84C',
  },
  tipSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: NEEDLE_LEN,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#C0CCDE',
  },
  centerPin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0C2461',
    borderWidth: 2.5,
    borderColor: '#fff',
    zIndex: 10,
  },

  infoRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    gap: 10,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0C2461',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoVal: { fontSize: 20, fontWeight: '800', color: '#0C2461', marginBottom: 4 },
  infoLbl: { fontSize: 11, color: '#8A96B0', fontWeight: '600', letterSpacing: 0.4 },

  footer: { marginTop: 22, alignItems: 'center', paddingHorizontal: 24 },
  footerLine:   { fontSize: 12, color: '#8A96B0', marginBottom: 3 },
  footerCoords: { fontSize: 11, color: '#B0BAC8', marginTop: 4 },
});
