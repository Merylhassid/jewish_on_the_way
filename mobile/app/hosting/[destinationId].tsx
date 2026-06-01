/**
 * Hosting entry — choose Guest or Host mode, then act accordingly.
 * Guest: search form → list of offers → send request
 * Host: create offer + manage received requests
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '@/src/api/client';
import HomeButton from '@/src/components/HomeButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Offer {
  id: number;
  availableFrom: string;
  availableTo: string;
  maxGuests: number;
  allowsChildren: boolean;
  allowsShabbat: boolean;
  kashrutLevel: string | null;
  notes: string | null;
  host: { id: number; firstName: string } | null;
}

// ─── Guest search form + results ─────────────────────────────────────────────

function GuestView({ destinationId }: { destinationId: number }) {
  const [arrivalObj, setArrivalObj]       = useState(new Date());
  const [departureObj, setDepartureObj]   = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [showArrival, setShowArrival]     = useState(false);
  const [showDeparture, setShowDeparture] = useState(false);
  const [guestsCount, setGuestsCount]     = useState('1');
  const [forShabbat, setForShabbat]       = useState(false);
  const [withChildren, setWithChildren]   = useState(false);
  const [offers, setOffers]               = useState<Offer[] | null>(null);
  const [loading, setLoading]             = useState(false);
  const [requestOffer, setRequestOffer]   = useState<Offer | null>(null);

  const arrivalDate   = arrivalObj.toISOString().split('T')[0];
  const departureDate = departureObj.toISOString().split('T')[0];

  const search = async () => {
    try {
      setLoading(true);
      const params: any = { destinationId };
      if (arrivalDate)   params.arrivalDate   = arrivalDate;
      if (departureDate) params.departureDate = departureDate;
      if (guestsCount)   params.guestsCount   = guestsCount;
      if (forShabbat)    params.forShabbat    = 'true';
      if (withChildren)  params.withChildren  = 'true';
      const res = await client.get('/hosting/offers/search', { params });
      setOffers(res.data);
    } catch {
      Alert.alert('Error', 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Find a Host Family</Text>

      <Text style={styles.label}>Arrival Date</Text>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <View style={styles.pickerBtn} lang="en" dir="ltr">
          {/* @ts-ignore */}
          <input type="date" value={arrivalDate} min={new Date().toISOString().split('T')[0]}
            onChange={(e: any) => { if (e.target.value) setArrivalObj(new Date(e.target.value)); }}
            style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
        </View>
      ) : (
        <>
          <Pressable style={styles.pickerBtn} onPress={() => setShowArrival(true)}>
            <Text style={styles.pickerBtnText}>📅  {arrivalDate}</Text>
          </Pressable>
          {showArrival && (
            <DateTimePicker value={arrivalObj} mode="date" minimumDate={new Date()}
              onChange={(_, d) => { setShowArrival(false); if (d) setArrivalObj(d); }} />
          )}
        </>
      )}

      <Text style={styles.label}>Departure Date</Text>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <View style={styles.pickerBtn} lang="en" dir="ltr">
          {/* @ts-ignore */}
          <input type="date" value={departureDate} min={arrivalDate}
            onChange={(e: any) => { if (e.target.value) setDepartureObj(new Date(e.target.value)); }}
            style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
        </View>
      ) : (
        <>
          <Pressable style={styles.pickerBtn} onPress={() => setShowDeparture(true)}>
            <Text style={styles.pickerBtnText}>📅  {departureDate}</Text>
          </Pressable>
          {showDeparture && (
            <DateTimePicker value={departureObj} mode="date" minimumDate={arrivalObj}
              onChange={(_, d) => { setShowDeparture(false); if (d) setDepartureObj(d); }} />
          )}
        </>
      )}

      <Text style={styles.label}>Number of Guests</Text>
      <TextInput style={styles.input} value={guestsCount} onChangeText={setGuestsCount}
        keyboardType="number-pad" placeholder="1" placeholderTextColor="#999" />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>🕍 Shabbat hosting</Text>
        <Switch value={forShabbat} onValueChange={setForShabbat} trackColor={{ true: '#1a3a6b' }} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>👨‍👩‍👧 With children</Text>
        <Switch value={withChildren} onValueChange={setWithChildren} trackColor={{ true: '#1a3a6b' }} />
      </View>

      <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Search Hosts</Text>}
      </TouchableOpacity>

      {offers !== null && (
        <>
          <Text style={styles.resultsTitle}>
            {offers.length} host{offers.length !== 1 ? 's' : ''} available
          </Text>
          {offers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyText}>No hosts match your criteria.{'\n'}Try adjusting your filters.</Text>
            </View>
          ) : (
            offers.map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.offerTop}>
                  <Text style={styles.offerHost}>🏠 {offer.host?.firstName ?? 'Host'}</Text>
                  <Text style={styles.offerGuests}>up to {offer.maxGuests} guests</Text>
                </View>
                <View style={styles.offerTags}>
                  {offer.allowsShabbat  && <Tag text="🕍 Shabbat" />}
                  {offer.allowsChildren && <Tag text="👨‍👩‍👧 Children OK" />}
                  {offer.kashrutLevel   && <Tag text={offer.kashrutLevel} />}
                </View>
                {offer.notes && <Text style={styles.offerNotes}>{offer.notes}</Text>}
                <Text style={styles.offerDates}>
                  📅 {offer.availableFrom} → {offer.availableTo}
                </Text>
                <TouchableOpacity style={styles.requestBtn} onPress={() => setRequestOffer(offer)}>
                  <Text style={styles.requestBtnText}>Send Request</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      )}

      {requestOffer && (
        <SendRequestModal
          offer={requestOffer}
          onClose={() => setRequestOffer(null)}
          defaultArrival={arrivalDate}
          defaultDeparture={departureDate}
          defaultGuests={guestsCount}
          defaultShabbat={forShabbat}
          defaultChildren={withChildren}
        />
      )}
    </ScrollView>
  );
}

// ─── Send Request Modal ───────────────────────────────────────────────────────

function SendRequestModal({
  offer, onClose, defaultArrival, defaultDeparture,
  defaultGuests, defaultShabbat, defaultChildren,
}: {
  offer: Offer; onClose: () => void;
  defaultArrival: string; defaultDeparture: string;
  defaultGuests: string; defaultShabbat: boolean; defaultChildren: boolean;
}) {
  const [arrivalObj, setArrivalObj]   = useState(() => defaultArrival ? new Date(defaultArrival) : new Date());
  const [departObj, setDepartObj]     = useState(() => defaultDeparture ? new Date(defaultDeparture) : new Date());
  const [showArr, setShowArr]         = useState(false);
  const [showDep, setShowDep]         = useState(false);
  const [guests, setGuests]           = useState(defaultGuests);
  const [shabbat, setShabbat]         = useState(defaultShabbat);
  const [children, setChildren]       = useState(defaultChildren);
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);

  const arrival   = arrivalObj.toISOString().split('T')[0];
  const departure = departObj.toISOString().split('T')[0];

  const send = async () => {
    if (!arrival || !departure) { Alert.alert('Error', 'Please enter arrival and departure dates'); return; }
    try {
      setLoading(true);
      await client.post('/hosting/requests', {
        offerId: offer.id,
        arrivalDate: arrival,
        departureDate: departure,
        guestsCount: parseInt(guests, 10) || 1,
        withChildren: children,
        forShabbat: shabbat,
        specialRequests: notes.trim() || undefined,
      });
      Alert.alert('Request Sent! 🎉', 'Your hosting request has been sent. You\'ll be notified when the host responds.');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Request Hosting</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>
          <Text style={styles.offerHostLabel}>Host: {offer.host?.firstName}</Text>

          <Text style={styles.label}>Arrival Date</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.pickerBtn}>
              {/* @ts-ignore */}
              <input type="date" lang="en" value={arrival} min={new Date().toISOString().split('T')[0]}
                onChange={(e: any) => { if (e.target.value) setArrivalObj(new Date(e.target.value)); }}
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowArr(true)}>
                <Text style={styles.pickerBtnText}>📅  {arrival}</Text>
              </Pressable>
              {showArr && (
                <DateTimePicker value={arrivalObj} mode="date" minimumDate={new Date()}
                  onChange={(_, d) => { setShowArr(false); if (d) setArrivalObj(d); }} />
              )}
            </>
          )}

          <Text style={styles.label}>Departure Date</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.pickerBtn}>
              {/* @ts-ignore */}
              <input type="date" lang="en" value={departure} min={arrival}
                onChange={(e: any) => { if (e.target.value) setDepartObj(new Date(e.target.value)); }}
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowDep(true)}>
                <Text style={styles.pickerBtnText}>📅  {departure}</Text>
              </Pressable>
              {showDep && (
                <DateTimePicker value={departObj} mode="date" minimumDate={arrivalObj}
                  onChange={(_, d) => { setShowDep(false); if (d) setDepartObj(d); }} />
              )}
            </>
          )}

          <Text style={styles.label}>Number of Guests</Text>
          <TextInput style={styles.input} value={guests} onChangeText={setGuests} keyboardType="number-pad" />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🕍 For Shabbat</Text>
            <Switch value={shabbat} onValueChange={setShabbat} trackColor={{ true: '#1a3a6b' }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>👨‍👩‍👧 With children</Text>
            <Switch value={children} onValueChange={setChildren} trackColor={{ true: '#1a3a6b' }} />
          </View>

          <Text style={styles.label}>Special requests (optional)</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes}
            placeholder="Dietary needs, accessibility, etc." placeholderTextColor="#999" multiline />

          <TouchableOpacity style={styles.searchBtn} onPress={send} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Send Request</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Host view — create offer + see requests ──────────────────────────────────

function HostView({ destinationId }: { destinationId: number }) {
  const [fromObj, setFromObj]               = useState(new Date());
  const [toObj, setToObj]                   = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; });
  const [showFrom, setShowFrom]             = useState(false);
  const [showTo, setShowTo]                 = useState(false);
  const [maxGuests, setMaxGuests]           = useState('2');

  const availableFrom = fromObj.toISOString().split('T')[0];
  const availableTo   = toObj.toISOString().split('T')[0];
  const [allowsShabbat, setAllowsShabbat]   = useState(false);
  const [allowsChildren, setAllowsChildren] = useState(false);
  const [kashrut, setKashrut]               = useState('');
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);

  const createOffer = async () => {
    if (!availableFrom || !availableTo) { Alert.alert('Error', 'Please enter your availability dates'); return; }
    try {
      setLoading(true);
      await client.post('/hosting/offers', {
        destinationId,
        availableFrom,
        availableTo,
        maxGuests: parseInt(maxGuests, 10) || 1,
        allowsShabbat,
        allowsChildren,
        kashrutLevel: kashrut.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Offer Created! 🏠', 'Your hosting offer is now visible to travelers.');
      setNotes(''); setKashrut(''); setMaxGuests('2');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Create a Hosting Offer</Text>

      <Text style={styles.label}>Available From</Text>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <View style={styles.pickerBtn} lang="en" dir="ltr">
          {/* @ts-ignore */}
          <input type="date" value={availableFrom} min={new Date().toISOString().split('T')[0]}
            onChange={(e: any) => { if (e.target.value) setFromObj(new Date(e.target.value)); }}
            style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
        </View>
      ) : (
        <>
          <Pressable style={styles.pickerBtn} onPress={() => setShowFrom(true)}>
            <Text style={styles.pickerBtnText}>📅  {availableFrom}</Text>
          </Pressable>
          {showFrom && (
            <DateTimePicker value={fromObj} mode="date" minimumDate={new Date()}
              onChange={(_, d) => { setShowFrom(false); if (d) setFromObj(d); }} />
          )}
        </>
      )}

      <Text style={styles.label}>Available Until</Text>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <View style={styles.pickerBtn} lang="en" dir="ltr">
          {/* @ts-ignore */}
          <input type="date" value={availableTo} min={availableFrom}
            onChange={(e: any) => { if (e.target.value) setToObj(new Date(e.target.value)); }}
            style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
        </View>
      ) : (
        <>
          <Pressable style={styles.pickerBtn} onPress={() => setShowTo(true)}>
            <Text style={styles.pickerBtnText}>📅  {availableTo}</Text>
          </Pressable>
          {showTo && (
            <DateTimePicker value={toObj} mode="date" minimumDate={fromObj}
              onChange={(_, d) => { setShowTo(false); if (d) setToObj(d); }} />
          )}
        </>
      )}

      <Text style={styles.label}>Max Guests</Text>
      <TextInput style={styles.input} value={maxGuests} onChangeText={setMaxGuests}
        keyboardType="number-pad" placeholder="2" placeholderTextColor="#999" />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>🕍 Shabbat hosting</Text>
        <Switch value={allowsShabbat} onValueChange={setAllowsShabbat} trackColor={{ true: '#1a3a6b' }} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>👨‍👩‍👧 Children welcome</Text>
        <Switch value={allowsChildren} onValueChange={setAllowsChildren} trackColor={{ true: '#1a3a6b' }} />
      </View>

      <Text style={styles.label}>Kashrut level (optional)</Text>
      <TextInput style={styles.input} value={kashrut} onChangeText={setKashrut}
        placeholder="e.g. mehadrin, badatz" placeholderTextColor="#999" />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes}
        placeholder="Room type, house rules, etc." placeholderTextColor="#999" multiline />

      <TouchableOpacity style={styles.searchBtn} onPress={createOffer} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Publish Offer</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/hosting/my-requests')}>
        <Text style={styles.outlineBtnText}>View Received Requests →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function Tag({ text }: { text: string }) {
  return <View style={styles.tag}><Text style={styles.tagText}>{text}</Text></View>;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HostingScreen() {
  const { destinationId, city } = useLocalSearchParams<{ destinationId: string; city?: string }>();
  const [mode, setMode] = useState<'choose' | 'guest' | 'host'>('choose');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (mode === 'choose' ? router.back() : setMode('choose'))}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <Text style={styles.headerTitle}>🏠 Shabbat Hosting{city ? ` — ${city}` : ''}</Text>
      </View>

      {mode === 'choose' && (
        <View style={styles.chooseBody}>
          <Text style={styles.chooseTitle}>What are you looking for?</Text>

          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('guest')}>
            <Text style={styles.modeEmoji}>🧳</Text>
            <Text style={styles.modeLabel}>I&apos;m looking for hosting</Text>
            <Text style={styles.modeSub}>Find a Jewish family to stay with</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.modeCard, styles.modeCardAlt]} onPress={() => setMode('host')}>
            <Text style={styles.modeEmoji}>🏠</Text>
            <Text style={styles.modeLabel}>I want to host</Text>
            <Text style={styles.modeSub}>Welcome travelers into your home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/hosting/my-requests')}>
            <Text style={styles.outlineBtnText}>My Requests →</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'guest' && <GuestView destinationId={Number(destinationId)} />}
      {mode === 'host'  && <HostView  destinationId={Number(destinationId)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4ff' },
  header:         { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:        { marginRight: 12 },
  backText:       { fontSize: 24, color: '#fff' },
  headerTitle:    { fontSize: 20, fontWeight: '700', color: '#fff' },
  chooseBody:     { flex: 1, padding: 24, gap: 16 },
  chooseTitle:    { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  modeCard:       { backgroundColor: '#fff', borderRadius: 18, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  modeCardAlt:    { backgroundColor: '#e8f4e8' },
  modeEmoji:      { fontSize: 40, marginBottom: 8 },
  modeLabel:      { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  modeSub:        { fontSize: 14, color: '#666' },
  body:           { padding: 20, gap: 4 },
  sectionTitle:   { fontSize: 18, fontWeight: '700', color: '#1a3a6b', marginBottom: 16 },
  label:          { fontSize: 13, fontWeight: '600', color: '#1a3a6b', marginBottom: 6, marginTop: 8 },
  input:          { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#dde3f0', color: '#1a1a2e', marginBottom: 4 },
  toggleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f4ff' },
  toggleLabel:    { fontSize: 15, color: '#333' },
  searchBtn:      { backgroundColor: '#1a3a6b', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  searchBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  outlineBtn:     { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#1a3a6b' },
  outlineBtnText: { color: '#1a3a6b', fontSize: 15, fontWeight: '600' },
  resultsTitle:   { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginTop: 24, marginBottom: 12 },
  offerCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  offerTop:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  offerHost:      { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  offerGuests:    { fontSize: 13, color: '#666' },
  offerTags:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  offerNotes:     { fontSize: 13, color: '#555', marginBottom: 6, fontStyle: 'italic' },
  offerDates:     { fontSize: 13, color: '#888', marginBottom: 10 },
  requestBtn:     { backgroundColor: '#1a3a6b', borderRadius: 10, padding: 12, alignItems: 'center' },
  requestBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tag:            { backgroundColor: '#e8eef8', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:        { fontSize: 12, color: '#1a3a6b', fontWeight: '500' },
  pickerBtn:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#dde3f0', marginBottom: 4 },
  pickerBtnText:  { fontSize: 15, color: '#1a1a2e', fontWeight: '500' },
  empty:          { alignItems: 'center', paddingTop: 40 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  overlay:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:     { fontSize: 20, fontWeight: '700', color: '#1a3a6b' },
  closeBtn:       { fontSize: 18, color: '#999' },
  offerHostLabel: { fontSize: 15, color: '#555', marginBottom: 16 },
});
