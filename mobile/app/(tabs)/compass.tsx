import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Fixed prayer target
const JERUSALEM = { lat: 31.7767, lng: 35.2345 };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle bearing from (lat1,lng1) toward Jerusalem, 0–360° */
function calcBearing(lat1: number, lng1: number): number {
  const dL = toRad(JERUSALEM.lng - lng1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(JERUSALEM.lat);
  const x = Math.sin(dL) * Math.cos(φ2);
  const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dL);
  return ((toDeg(Math.atan2(x, y)) + 360) % 360);
}

/** Haversine distance in km */
function calcDistance(lat1: number, lng1: number): number {
  const R = 6371;
  const dLat = toRad(JERUSALEM.lat - lat1);
  const dLng = toRad(JERUSALEM.lng - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(JERUSALEM.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Take the short path between two angles (avoids 359°→1° spinning backwards) */
function shortestAngle(prev: number, next: number): number {
  let diff = ((next - prev) % 360 + 360) % 360;
  if (diff > 180) diff -= 360;
  return prev + diff;
}

// 16-point compass rose label
const COMPASS_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function headingLabel(deg: number) {
  return COMPASS_DIRS[Math.round(deg / 22.5) % 16];
}

// Cardinal and ordinal positions for the rotating disc
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
const LABEL_RADIUS = DISC_RADIUS - 26; // how far labels sit from center
const NEEDLE_LEN  = 88;                // half-length of needle (each tip)

export default function CompassScreen() {
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

      // One-shot GPS
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocation({ lat, lng });

      const b = calcBearing(lat, lng);
      latestBearing.current = b;
      setBearing(b);
      setDistance(calcDistance(lat, lng));

      // Continuous heading
      sub = await Location.watchHeadingAsync((h) => {
        const mag = h.magHeading ?? 0;
        setHeading(mag);

        // Disc rotates so N always points to actual magnetic north
        const nextDisc = shortestAngle(prevDisc.current, -mag);
        prevDisc.current = nextDisc;
        Animated.spring(discAnim, { toValue: nextDisc, speed: 20, bounciness: 2, useNativeDriver: true }).start();

        // Needle points to Jerusalem
        const bear = latestBearing.current ?? 0;
        const nextNeedle = shortestAngle(prevNeedle.current, bear - mag);
        prevNeedle.current = nextNeedle;
        Animated.spring(needleAnim, { toValue: nextNeedle, speed: 20, bounciness: 2, useNativeDriver: true }).start();
      });
    })();

    return () => { sub?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-animate needle when bearing changes
  useEffect(() => {
    if (bearing === null) return;
    latestBearing.current = bearing;
    const nextNeedle = shortestAngle(prevNeedle.current, bearing - heading);
    prevNeedle.current = nextNeedle;
    Animated.spring(needleAnim, { toValue: nextNeedle, speed: 20, bounciness: 2, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearing]);

  const discRotate   = discAnim.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  const needleRotate = needleAnim.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });

  // ── Permission denied ──────────────────────────────────────────────────────
  if (permStatus === 'denied') {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.bigIcon}>📍</Text>
        <Text style={styles.permTitle}>Location Required</Text>
        <Text style={styles.permSub}>
          Enable location permission in your device settings to use the prayer compass.
        </Text>
      </View>
    );
  }

  // ── Loading / acquiring GPS ────────────────────────────────────────────────
  if (permStatus === 'unknown' || !location) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.bigIcon}>🧭</Text>
        <Text style={styles.loadingText}>Acquiring GPS fix…</Text>
      </View>
    );
  }

  // ── Main compass UI ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>✡</Text>
        <Text style={styles.headerTitle}>Prayer Direction</Text>
        <Text style={styles.headerSub}>Compass pointing toward Jerusalem</Text>
      </View>

      {/* Compass */}
      <View style={styles.compassOuter}>
        {/* Shadow / background disc */}
        <View style={styles.discBackground} />

        {/* Rotating compass rose (N/E/S/W labels + tick ring) */}
        <Animated.View style={[styles.disc, { transform: [{ rotate: discRotate }] }]}>
          {/* Outer tick ring */}
          <View style={styles.tickRing} />

          {/* Cardinal & ordinal labels */}
          {DISC_LABELS.map(({ label, angle, isCardinal }) => {
            const rad = toRad(angle - 90); // -90 so 0° is at top
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

        {/* Jerusalem needle (animated) */}
        <Animated.View
          style={[styles.needleContainer, { transform: [{ rotate: needleRotate }] }]}
          pointerEvents="none"
        >
          {/* Gold tip → Jerusalem */}
          <View style={styles.tipJerusalem} />
          {/* Grey tail */}
          <View style={styles.tipSouth} />
        </Animated.View>

        {/* Star of David — rides on the gold tip */}
        <Animated.View
          style={[
            styles.starContainer,
            { transform: [{ rotate: needleRotate }] },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.starIcon}>✡</Text>
        </Animated.View>

        {/* Centre pin */}
        <View style={styles.centerPin} />
      </View>

      {/* Info strip */}
      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoVal}>{bearing !== null ? `${Math.round(bearing)}°` : '—'}</Text>
          <Text style={styles.infoLbl}>Bearing</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoVal}>
            {distance !== null
              ? distance >= 1000
                ? `${Math.round(distance / 100) / 10}k km`
                : `${Math.round(distance)} km`
              : '—'}
          </Text>
          <Text style={styles.infoLbl}>Distance</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoVal}>{Math.round(heading)}°</Text>
          <Text style={styles.infoLbl}>{headingLabel(heading)}</Text>
        </View>
      </View>

      {/* Footnote */}
      <View style={styles.footer}>
        <Text style={styles.footerLine}>🟡 Gold needle → Jerusalem</Text>
        <Text style={styles.footerLine}>Disc rotates to show magnetic north</Text>
        <Text style={styles.footerCoords}>Jerusalem · 31.7767°N, 35.2345°E</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f0f4ff' },
  centered:   { justifyContent: 'center', alignItems: 'center', padding: 32 },

  bigIcon:    { fontSize: 56, marginBottom: 16 },
  permTitle:  { fontSize: 20, fontWeight: '700', color: '#1a3a6b', marginBottom: 8, textAlign: 'center' },
  permSub:    { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  loadingText:{ fontSize: 16, color: '#1a3a6b', fontWeight: '500' },

  header: {
    backgroundColor: '#1a3a6b',
    paddingTop: 64,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerIcon:  { fontSize: 30, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 2 },
  headerSub:   { fontSize: 13, color: '#a8c4e8' },

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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  disc: {
    position: 'absolute',
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickRing: {
    position: 'absolute',
    width: DISC_SIZE - 8,
    height: DISC_SIZE - 8,
    borderRadius: (DISC_SIZE - 8) / 2,
    borderWidth: 2,
    borderColor: '#d0daf0',
  },
  dirLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
  dirLabelCardinal: { fontSize: 15, color: '#4a6080', width: 16 },
  dirLabelOrdinal:  { fontSize: 11, color: '#9aadc8', width: 20 },
  dirLabelN:        { color: '#1a3a6b', fontSize: 17 },

  needleContainer: {
    position: 'absolute',
    width: 14,
    height: NEEDLE_LEN * 2,
    alignItems: 'center',
    zIndex: 8,
  },
  tipJerusalem: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: NEEDLE_LEN,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#d4a017',
  },
  tipSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: NEEDLE_LEN,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#a0b0c8',
  },

  // Star rides on the gold tip: positioned NEEDLE_LEN above center
  starContainer: {
    position: 'absolute',
    top: DISC_RADIUS - NEEDLE_LEN - 12,
    width: DISC_SIZE,
    alignItems: 'center',
    zIndex: 9,
  },
  starIcon: { fontSize: 16, color: '#d4a017' },

  centerPin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a3a6b',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },

  infoRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    gap: 10,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoVal: { fontSize: 20, fontWeight: '700', color: '#1a3a6b', marginBottom: 2 },
  infoLbl: { fontSize: 11, color: '#888', fontWeight: '500' },

  footer: { marginTop: 20, alignItems: 'center', paddingHorizontal: 24 },
  footerLine:   { fontSize: 12, color: '#888', marginBottom: 2 },
  footerCoords: { fontSize: 11, color: '#bbb', marginTop: 4 },
});
