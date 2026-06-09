import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

// ─── Constants ────────────────────────────────────────────────────────────────

const JERUSALEM = { lat: 31.7767, lng: 35.2345 };
const DISC_SIZE = 300;
const CENTER    = DISC_SIZE / 2;
const OUTER_R   = CENTER - 6;
const LABEL_R   = OUTER_R - 34;
const NEEDLE_N  = 92;
const NEEDLE_S  = 52;
const NEEDLE_W  = 8;
const ALIGN_THRESHOLD = 10; // degrees — "facing Jerusalem"

const NAVY   = '#0C2461';
const ACCENT     = '#4A90D9';  // sky blue — replaces gold
const ACCENT_SVG = '#5B9FE8';  // lighter, visible on dark disc

// ─── Math helpers ─────────────────────────────────────────────────────────────

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

// Returns signed offset (−180..+180): positive = turn right, negative = turn left
function angleDiff(bearing: number, heading: number): number {
  let d = ((bearing - heading) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

function formatUpdated(date: Date, t: (k: string, o?: any) => string): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return t('compass.updatedJustNow');
  if (sec < 60) return t('compass.updatedSecondsAgo', { n: sec });
  return t('compass.updatedMinutesAgo', { n: Math.floor(sec / 60) });
}

const COMPASS_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function headingLabel(deg: number) {
  return COMPASS_DIRS[Math.round(deg / 22.5) % 16];
}

// ─── Pre-computed SVG tick marks ──────────────────────────────────────────────

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const deg    = i * 5;
  const rad    = toRad(deg - 90);
  const isCard = deg % 90 === 0;
  const isOrd  = deg % 45 === 0 && !isCard;
  const isTen  = deg % 10 === 0 && !isOrd && !isCard;
  const inner  = isCard ? OUTER_R - 22 : isOrd ? OUTER_R - 15 : isTen ? OUTER_R - 10 : OUTER_R - 6;
  return {
    x1: CENTER + OUTER_R * Math.cos(rad),
    y1: CENTER + OUTER_R * Math.sin(rad),
    x2: CENTER + inner   * Math.cos(rad),
    y2: CENTER + inner   * Math.sin(rad),
    strokeWidth: isCard ? 2.5 : isOrd ? 1.5 : isTen ? 1 : 0.7,
    stroke: isCard
      ? ACCENT_SVG
      : isOrd  ? 'rgba(74,144,217,0.55)'
      : isTen  ? 'rgba(255,255,255,0.28)'
      :           'rgba(255,255,255,0.12)',
  };
});

const DIR_LABELS = [
  { label: 'N',  angle: 0,   color: ACCENT_SVG,                size: 21, weight: '800' },
  { label: 'E',  angle: 90,  color: '#FFFFFF',                size: 15, weight: '700' },
  { label: 'S',  angle: 180, color: '#FFFFFF',                size: 15, weight: '700' },
  { label: 'W',  angle: 270, color: '#FFFFFF',                size: 15, weight: '700' },
  { label: 'NE', angle: 45,  color: 'rgba(255,255,255,0.40)', size: 10, weight: '600' },
  { label: 'SE', angle: 135, color: 'rgba(255,255,255,0.40)', size: 10, weight: '600' },
  { label: 'SW', angle: 225, color: 'rgba(255,255,255,0.40)', size: 10, weight: '600' },
  { label: 'NW', angle: 315, color: 'rgba(255,255,255,0.40)', size: 10, weight: '600' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompassScreen() {
  const { t } = useTranslation();
  const [permStatus, setPermStatus] = useState<'unknown' | 'denied' | 'granted'>('unknown');
  const [location, setLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const [cityName, setCityName]     = useState<string | null>(null);
  const [heading, setHeading]       = useState(0);
  const [bearing, setBearing]       = useState<number | null>(null);
  const [distance, setDistance]     = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, forceRender]             = useState(0); // drives "X sec ago" refreshes

  const discAnim      = useRef(new Animated.Value(0)).current;
  const needleAnim    = useRef(new Animated.Value(0)).current;
  const prevDisc      = useRef(0);
  const prevNeedle    = useRef(0);
  const latestBearing = useRef<number | null>(null);

  // Smooth timing animation — no bounce, clean easing
  const animateTo = (anim: Animated.Value, value: number) => {
    Animated.timing(anim, {
      toValue: value,
      duration: 120,
      easing: Easing.out(Easing.sin),
      useNativeDriver: true,
    }).start();
  };

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
      setLastUpdated(new Date());

      // Reverse geocode to get city name
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const city = place?.city || place?.district || place?.subregion || place?.region || null;
        setCityName(city);
      } catch { /* non-critical */ }

      const b = calcBearing(lat, lng);
      latestBearing.current = b;
      setBearing(b);
      setDistance(calcDistance(lat, lng));

      sub = await Location.watchHeadingAsync((h) => {
        const mag = h.magHeading ?? h.trueHeading ?? 0;
        setHeading(mag);
        setLastUpdated(new Date());

        const nextDisc = shortestAngle(prevDisc.current, -mag);
        prevDisc.current = nextDisc;
        animateTo(discAnim, nextDisc);

        const bear = latestBearing.current ?? 0;
        const nextNeedle = shortestAngle(prevNeedle.current, bear - mag);
        prevNeedle.current = nextNeedle;
        animateTo(needleAnim, nextNeedle);
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
    animateTo(needleAnim, nextNeedle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearing]);

  // Refresh "X sec ago" every 15 s
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const discRotate   = discAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });
  const needleRotate = needleAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });

  // Alignment state
  const diff       = bearing !== null ? angleDiff(bearing, heading) : null;
  const isFacing   = diff !== null && Math.abs(diff) <= ALIGN_THRESHOLD;
  const turnDeg    = diff !== null ? Math.abs(Math.round(diff)) : null;
  const turnDir    = diff !== null ? (diff > 0 ? 'right' : 'left') : null;

  // ── Permission denied ─────────────────────────────────────────────────────
  if (permStatus === 'denied') {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header t={t} />
        <View style={s.stateBox}>
          <View style={s.stateIconRing}>
            <MaterialIcons name="location-off" size={34} color={ACCENT} />
          </View>
          <Text style={s.stateTitle}>{t('compass.permTitle')}</Text>
          <Text style={s.stateSub}>{t('compass.permSub')}</Text>
        </View>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (permStatus === 'unknown' || !location) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header t={t} />
        <View style={s.stateBox}>
          <ActivityIndicator size="large" color={ACCENT} style={{ marginBottom: 20 }} />
          <Text style={s.loadingText}>{t('compass.acquiring')}</Text>
        </View>
      </View>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header t={t} sub={t('compass.subtitle')} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Compass scene ─────────────────────────────────────────── */}
        <View style={s.scene}>
          <View style={s.halo3} />
          <View style={s.halo2} />
          <View style={s.halo1} />

          <View style={s.compassBody}>
            {/* Rotating SVG disc */}
            <Animated.View style={[s.disc, { transform: [{ rotate: discRotate }] }]}>
              <Svg width={DISC_SIZE} height={DISC_SIZE}>
                <Defs>
                  <RadialGradient id="rg" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%"   stopColor="#1C2B50" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#060A1C" stopOpacity="1" />
                  </RadialGradient>
                </Defs>
                <Circle cx={CENTER} cy={CENTER} r={CENTER - 1} fill="url(#rg)" />
                <Circle cx={CENTER} cy={CENTER} r={CENTER - 1}
                  fill="none" stroke="rgba(74,144,217,0.22)" strokeWidth={1.5} />
                {TICKS.map((tk, i) => (
                  <Line key={i}
                    x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
                    stroke={tk.stroke} strokeWidth={tk.strokeWidth} strokeLinecap="round"
                  />
                ))}
                {DIR_LABELS.map(({ label, angle, color, size, weight }) => {
                  const rad = toRad(angle - 90);
                  return (
                    <SvgText
                      key={label}
                      x={CENTER + LABEL_R * Math.cos(rad)}
                      y={CENTER + LABEL_R * Math.sin(rad)}
                      fill={color} fontSize={size} fontWeight={weight}
                      textAnchor="middle" alignmentBaseline="central"
                    >
                      {label}
                    </SvgText>
                  );
                })}
                <Circle cx={CENTER} cy={CENTER} r={68}
                  fill="none" stroke="rgba(74,144,217,0.06)" strokeWidth={1} />
                <Circle cx={CENTER} cy={CENTER} r={42}
                  fill="none" stroke="rgba(74,144,217,0.04)" strokeWidth={1} />
              </Svg>
            </Animated.View>

            {/* Needle glow bar — soft gold light behind needle */}
            <Animated.View
              style={[s.needleGlowWrap, { transform: [{ rotate: needleRotate }] }]}
              pointerEvents="none"
            >
              <View style={s.needleGlowBar} />
            </Animated.View>

            {/* Jerusalem needle */}
            <Animated.View
              style={[s.needle, { transform: [{ rotate: needleRotate }] }]}
              pointerEvents="none"
            >
              <View style={s.needleN} />
              <View style={s.needleS} />
            </Animated.View>

            {/* Center pin */}
            <View style={s.pin}>
              <View style={s.pinDot} />
            </View>
          </View>
        </View>

        {/* ── Alignment feedback ────────────────────────────────────── */}
        <View style={[s.alignBanner, isFacing && s.alignBannerFacing]}>
          <MaterialIcons
            name={isFacing ? 'check-circle' : 'rotate-right'}
            size={15}
            color={isFacing ? '#16A34A' : NAVY}
            style={{ marginRight: 7 }}
          />
          <Text style={[s.alignText, isFacing && s.alignTextFacing]}>
            {isFacing
              ? t('compass.facingJerusalem')
              : turnDir === 'right'
                ? t('compass.turnRight', { deg: turnDeg })
                : t('compass.turnLeft',  { deg: turnDeg })}
          </Text>
        </View>

        {/* ── Three stat cards ──────────────────────────────────────── */}
        <View style={s.infoRow}>
          <InfoCard
            icon="navigation"
            value={bearing !== null ? `${Math.round(bearing)}°` : '—'}
            label={t('compass.bearing')}
          />
          <InfoCard
            icon="place"
            value={
              distance !== null
                ? distance >= 1000
                  ? `${Math.round(distance / 100) / 10}k`
                  : `${Math.round(distance)}`
                : '—'
            }
            label={`${t('compass.distance')} km`}
            highlight
          />
          <InfoCard
            icon="explore"
            value={`${Math.round(heading)}°`}
            label={headingLabel(heading)}
          />
        </View>

        {/* ── Smart location card ───────────────────────────────────── */}
        <View style={s.locationCard}>
          <View style={s.locationCardHeader}>
            <MaterialIcons name="my-location" size={14} color={ACCENT} style={{ marginRight: 6 }} />
            <Text style={s.locationCardTitle}>{t('compass.locationDetails')}</Text>
            {lastUpdated && (
              <Text style={s.locationCardUpdated}>
                {formatUpdated(lastUpdated, t)}
              </Text>
            )}
          </View>
          <View style={s.locationDivider} />
          <View style={s.locationRow}>
            <Text style={s.locationLabel}>{t('compass.currentLocation')}</Text>
            <Text style={s.locationValue}>
              {cityName ?? `${location.lat.toFixed(3)}°, ${location.lng.toFixed(3)}°`}
            </Text>
          </View>
          <View style={s.locationRow}>
            <Text style={s.locationLabel}>{t('compass.directionToJerusalem')}</Text>
            <Text style={s.locationValue}>
              {bearing !== null ? `${Math.round(bearing)}° ${headingLabel(Math.round(bearing))}` : '—'}
            </Text>
          </View>
          <View style={[s.locationRow, { marginBottom: 0 }]}>
            <Text style={s.locationLabel}>{t('compass.distanceFromJerusalem')}</Text>
            <Text style={[s.locationValue, { color: ACCENT }]}>
              {distance !== null
                ? distance >= 1000
                  ? `${(distance / 1000).toFixed(1)}k km`
                  : `${Math.round(distance)} km`
                : '—'}
            </Text>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerQuote}>{t('compass.inspirationalLine')}</Text>
          <Text style={s.footerCoords}>{t('compass.coords')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ t, sub }: { t: (k: string) => string; sub?: string }) {
  return (
    <View style={s.header}>
      <Text style={s.eyebrow}>JEWISH ON THE WAY</Text>
      <Image source={require('@/assets/images/logo.jpeg')} style={s.logo} />
      <Text style={s.title}>{t('compass.title')}</Text>
      {sub ? <Text style={s.subtitle}>{sub}</Text> : null}
    </View>
  );
}

function InfoCard({
  icon, value, label, highlight,
}: { icon: string; value: string; label: string; highlight?: boolean }) {
  return (
    <View style={[s.card, highlight && s.cardHL]}>
      <MaterialIcons
        name={icon as any}
        size={17}
        color={highlight ? ACCENT : NAVY}
        style={{ marginBottom: 5, opacity: 0.65 }}
      />
      <Text style={[s.cardValue, highlight && s.cardValueHL]}>{value}</Text>
      <Text style={s.cardLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SCENE = DISC_SIZE + 80;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll:    { paddingBottom: 48 },

  // Header
  header: {
    paddingTop: 56, paddingBottom: 18,
    alignItems: 'center', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(12,36,97,0.08)',
  },
  eyebrow:  { fontSize: 9, fontWeight: '700', color: ACCENT, letterSpacing: 3.2, marginBottom: 8 },
  logo:     { width: 38, height: 38, resizeMode: 'contain', borderRadius: 19, marginBottom: 8 },
  title:    { fontSize: 23, fontWeight: '800', color: NAVY, letterSpacing: 0.4, marginBottom: 2 },
  subtitle: { fontSize: 11, color: 'rgba(0,0,0,0.38)' },

  // States
  stateBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36 },
  stateIconRing: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(58,123,213,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(58,123,213,0.28)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  stateTitle:  { fontSize: 19, fontWeight: '700', color: NAVY, marginBottom: 10, textAlign: 'center' },
  stateSub:    { fontSize: 14, color: 'rgba(0,0,0,0.5)', textAlign: 'center', lineHeight: 22 },
  loadingText: { fontSize: 15, color: 'rgba(0,0,0,0.45)', fontWeight: '500' },

  // Compass scene
  scene: {
    alignSelf: 'center', marginTop: 24,
    width: SCENE, height: SCENE,
    justifyContent: 'center', alignItems: 'center',
  },
  halo3: {
    position: 'absolute', width: SCENE, height: SCENE, borderRadius: SCENE / 2,
    backgroundColor: 'rgba(74,144,217,0.018)',
  },
  halo2: {
    position: 'absolute',
    width: DISC_SIZE + 40, height: DISC_SIZE + 40,
    borderRadius: (DISC_SIZE + 40) / 2,
    backgroundColor: 'rgba(74,144,217,0.030)',
    borderWidth: 1, borderColor: 'rgba(74,144,217,0.07)',
  },
  halo1: {
    position: 'absolute',
    width: DISC_SIZE + 10, height: DISC_SIZE + 10,
    borderRadius: (DISC_SIZE + 10) / 2,
    backgroundColor: 'rgba(74,144,217,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(74,144,217,0.18)',
  },
  compassBody: {
    width: DISC_SIZE, height: DISC_SIZE, borderRadius: DISC_SIZE / 2,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: NAVY, shadowOpacity: 0.22, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 20,
  },
  disc: {
    position: 'absolute', width: DISC_SIZE, height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2, overflow: 'hidden',
  },

  // Needle glow (soft bar behind the needle)
  needleGlowWrap: {
    position: 'absolute',
    width: 6,
    alignItems: 'center',
    zIndex: 7,
  },
  needleGlowBar: {
    width: 3,
    height: NEEDLE_N + NEEDLE_S,
    borderRadius: 2,
    backgroundColor: 'rgba(74,144,217,0.25)',
    shadowColor: ACCENT_SVG,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },

  // Needle
  needle: {
    position: 'absolute', width: NEEDLE_W * 2,
    alignItems: 'center', zIndex: 8,
  },
  needleN: {
    width: 0, height: 0,
    borderLeftWidth: NEEDLE_W, borderRightWidth: NEEDLE_W,
    borderBottomWidth: NEEDLE_N,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: ACCENT_SVG,
  },
  needleS: {
    width: 0, height: 0,
    borderLeftWidth: NEEDLE_W, borderRightWidth: NEEDLE_W,
    borderTopWidth: NEEDLE_S,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(80,110,210,0.5)',
  },

  // Center pin
  pin: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#06091A', borderWidth: 2, borderColor: ACCENT_SVG,
    zIndex: 10, justifyContent: 'center', alignItems: 'center',
    shadowColor: ACCENT_SVG, shadowOpacity: 0.55, shadowRadius: 6, elevation: 14,
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT_SVG },

  // Alignment banner
  alignBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 18, marginTop: 16, marginBottom: 4,
    paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(12,36,97,0.04)',
    borderWidth: 1, borderColor: 'rgba(12,36,97,0.07)',
  },
  alignBannerFacing: {
    backgroundColor: 'rgba(22,163,74,0.06)',
    borderColor: 'rgba(22,163,74,0.18)',
  },
  alignText: { fontSize: 13, fontWeight: '600', color: NAVY },
  alignTextFacing: { color: '#16A34A' },

  // Three stat cards
  infoRow: { flexDirection: 'row', marginHorizontal: 18, marginTop: 12, gap: 10 },
  card: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(12,36,97,0.08)',
    shadowColor: NAVY, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  cardHL: {
    backgroundColor: 'rgba(58,123,213,0.07)',
    borderColor: 'rgba(58,123,213,0.25)',
  },
  cardValue:   { fontSize: 20, fontWeight: '800', color: NAVY, marginBottom: 3 },
  cardValueHL: { color: ACCENT },
  cardLabel:   { fontSize: 9, color: 'rgba(0,0,0,0.38)', fontWeight: '600', letterSpacing: 0.7, textAlign: 'center' },

  // Smart location card
  locationCard: {
    marginHorizontal: 18, marginTop: 14,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(12,36,97,0.08)',
    shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  locationCardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  locationCardTitle: { fontSize: 12, fontWeight: '700', color: NAVY, flex: 1, letterSpacing: 0.3 },
  locationCardUpdated: { fontSize: 10, color: 'rgba(0,0,0,0.3)', fontWeight: '500' },
  locationDivider: { height: 1, backgroundColor: 'rgba(12,36,97,0.06)', marginBottom: 12 },
  locationRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  locationLabel: { fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: '500' },
  locationValue: { fontSize: 12, fontWeight: '700', color: NAVY, textAlign: 'right', flexShrink: 1, marginLeft: 12 },

  // Footer
  footer:      { marginTop: 28, alignItems: 'center', paddingHorizontal: 32 },
  footerQuote: { fontSize: 12, color: 'rgba(0,0,0,0.35)', fontStyle: 'italic', textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  footerCoords:{ fontSize: 10, color: 'rgba(0,0,0,0.2)', textAlign: 'center' },
});
