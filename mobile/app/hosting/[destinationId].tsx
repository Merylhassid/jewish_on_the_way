/**
 * Hosting entry — choose Guest or Host mode, then act accordingly.
 * Guest: search form → list of offers → send request
 * Host: create offer + manage received requests
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, Home, Users, Search, MessageCircle } from 'lucide-react-native';
import client from '@/src/api/client';
import SwipeableSheet from '@/src/components/SwipeableSheet';
import { C } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Need {
  id: number;
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  notes: string | null;
  isOpen: boolean;
  guest: { id: number; firstName: string } | null;
}

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

// ─── Post a Need Modal ────────────────────────────────────────────────────────

function PostNeedModal({ destinationId, onClose, onPosted }: { destinationId: number; onClose: () => void; onPosted: () => void }) {
  const { t } = useTranslation();
  const [arrivalObj, setArrivalObj]     = useState(new Date());
  const [departureObj, setDepartureObj] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [showArr, setShowArr]           = useState(false);
  const [showDep, setShowDep]           = useState(false);
  const [guests, setGuests]             = useState('1');
  const [shabbat, setShabbat]           = useState(false);
  const [children, setChildren]         = useState(false);
  const [notes, setNotes]               = useState('');
  const [loading, setLoading]           = useState(false);

  const arrival   = arrivalObj.toISOString().split('T')[0];
  const departure = departureObj.toISOString().split('T')[0];

  const submit = async () => {
    try {
      setLoading(true);
      await client.post('/hosting/needs', {
        destinationId,
        arrivalDate: arrival,
        departureDate: departure,
        guestsCount: parseInt(guests, 10) || 1,
        forShabbat: shabbat,
        withChildren: children,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Posted!', 'Your hosting request is visible to all hosts. You\'ll be notified when someone responds.');
      onPosted();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>🙋 Post a Hosting Need</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            No available hosts? Post your need and hosts will reach out to you.
          </Text>

          <Text style={styles.label}>{t('hosting.arrivalDate')}</Text>
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
              {showArr && <DateTimePicker value={arrivalObj} mode="date" minimumDate={new Date()}
                onChange={(_, d) => { setShowArr(false); if (d) setArrivalObj(d); }} />}
            </>
          )}

          <Text style={styles.label}>{t('hosting.departureDate')}</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.pickerBtn}>
              {/* @ts-ignore */}
              <input type="date" lang="en" value={departure} min={arrival}
                onChange={(e: any) => { if (e.target.value) setDepartureObj(new Date(e.target.value)); }}
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#1a1a2e', outline: 'none', width: '100%', cursor: 'pointer' }} />
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowDep(true)}>
                <Text style={styles.pickerBtnText}>📅  {departure}</Text>
              </Pressable>
              {showDep && <DateTimePicker value={departureObj} mode="date" minimumDate={arrivalObj}
                onChange={(_, d) => { setShowDep(false); if (d) setDepartureObj(d); }} />}
            </>
          )}

          <Text style={styles.label}>{t('hosting.numberOfGuests')}</Text>
          <TextInput style={styles.input} value={guests} onChangeText={setGuests} keyboardType="number-pad" />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('hosting.forShabbat')}</Text>
            <Switch value={shabbat} onValueChange={setShabbat} trackColor={{ true: C.navy }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('hosting.withChildren')}</Text>
            <Switch value={children} onValueChange={setChildren} trackColor={{ true: C.navy }} />
          </View>

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput style={[styles.input, { height: 60 }]} value={notes} onChangeText={setNotes}
            placeholder="Any special requirements..." placeholderTextColor="#999" multiline />

          <TouchableOpacity style={styles.searchBtn} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Post Request</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Guest search form + results ─────────────────────────────────────────────

function GuestView({ destinationId }: { destinationId: number }) {
  const { t } = useTranslation();
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
  const [postNeedVisible, setPostNeedVisible] = useState(false);

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
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>{t('hosting.searchTitle')}</Text>

      <Text style={styles.label}>{t('hosting.arrivalDate')}</Text>
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

      <Text style={styles.label}>{t('hosting.departureDate')}</Text>
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

      <Text style={styles.label}>{t('hosting.numberOfGuests')}</Text>
      <TextInput style={styles.input} value={guestsCount} onChangeText={setGuestsCount}
        keyboardType="number-pad" placeholder="1" placeholderTextColor="#999" />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t('hosting.shabbatToggle')}</Text>
        <Switch value={forShabbat} onValueChange={setForShabbat} trackColor={{ true: C.navy }} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t('hosting.withChildren')}</Text>
        <Switch value={withChildren} onValueChange={setWithChildren} trackColor={{ true: C.navy }} />
      </View>

      <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.searchBtn')}</Text>}
      </TouchableOpacity>

      {offers !== null && (
        <>
          <Text style={styles.resultsTitle}>
            {offers.length} {offers.length !== 1 ? t('hosting.hostsAvailable') : t('hosting.hostAvailable')}
          </Text>
          {offers.length === 0 ? null : (
            offers.map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.offerTop}>
                  <Text style={styles.offerHost}>🏠 {offer.host?.firstName ?? t('hosting.hostLabel')}</Text>
                  <Text style={styles.offerGuests}>{t('hosting.upToGuests')} {offer.maxGuests} {t('hosting.guests')}</Text>
                </View>
                <View style={styles.offerTags}>
                  {offer.allowsShabbat  && <Tag text={t('hosting.shabbatTag')} />}
                  {offer.allowsChildren && <Tag text={t('hosting.childrenOk')} />}
                  {offer.kashrutLevel   && <Tag text={offer.kashrutLevel} />}
                </View>
                {offer.notes && <Text style={styles.offerNotes}>{offer.notes}</Text>}
                <Text style={styles.offerDates}>
                  📅 {offer.availableFrom} → {offer.availableTo}
                </Text>
                <TouchableOpacity style={styles.requestBtn} onPress={() => setRequestOffer(offer)}>
                  <Text style={styles.requestBtnText}>{t('hosting.sendRequest')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      )}

      {/* No results — offer to post a need */}
      {offers !== null && offers.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyText}>{t('hosting.noHosts')}</Text>
          <TouchableOpacity style={[styles.searchBtn, { marginTop: 16 }]} onPress={() => setPostNeedVisible(true)}>
            <Text style={styles.searchBtnText}>🙋 Post a Hosting Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Always show "post a need" option after results */}
      {offers !== null && offers.length > 0 && (
        <TouchableOpacity style={styles.outlineBtn} onPress={() => setPostNeedVisible(true)}>
          <Text style={styles.outlineBtnText}>{"🙋 Don't see a match? Post a request →"}</Text>
        </TouchableOpacity>
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

      {postNeedVisible && (
        <PostNeedModal
          destinationId={destinationId}
          onClose={() => setPostNeedVisible(false)}
          onPosted={() => {}}
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
  const { t } = useTranslation();

  const arrival   = arrivalObj.toISOString().split('T')[0];
  const departure = departObj.toISOString().split('T')[0];

  const send = async () => {
    if (!arrival || !departure) { Alert.alert(t('common.error'), t('hosting.arrivalDate')); return; }
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
      Alert.alert(t('hosting.requestSentTitle'), t('hosting.requestSentMsg'));
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('hosting.requestTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>
          <Text style={styles.offerHostLabel}>{t('hosting.hostLabel')}: {offer.host?.firstName}</Text>

          <Text style={styles.label}>{t('hosting.arrivalDate')}</Text>
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

          <Text style={styles.label}>{t('hosting.departureDate')}</Text>
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

          <Text style={styles.label}>{t('hosting.numberOfGuests')}</Text>
          <TextInput style={styles.input} value={guests} onChangeText={setGuests} keyboardType="number-pad" />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('hosting.forShabbat')}</Text>
            <Switch value={shabbat} onValueChange={setShabbat} trackColor={{ true: C.navy }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('hosting.withChildren')}</Text>
            <Switch value={children} onValueChange={setChildren} trackColor={{ true: C.navy }} />
          </View>

          <Text style={styles.label}>{t('hosting.specialRequests')}</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes}
            placeholder="" placeholderTextColor="#999" multiline />

          <TouchableOpacity style={styles.searchBtn} onPress={send} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.sendRequest')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Host view — create offer + see requests ──────────────────────────────────

function HostView({ destinationId }: { destinationId: number }) {
  const { t } = useTranslation();
  const [needs, setNeeds]                   = useState<Need[]>([]);
  const [needsLoading, setNeedsLoading]     = useState(true);
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

  useEffect(() => {
    setNeedsLoading(true);
    client.get('/hosting/needs', { params: { destinationId } })
      .then(res => setNeeds(res.data))
      .catch(() => Alert.alert(t('common.error'), t('common.retry')))
      .finally(() => setNeedsLoading(false));
  }, [destinationId]);

  const respondToNeed = (needId: number) => {
    Alert.alert(
      'Confirm hosting',
      'You are about to commit to hosting these guests. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I can host',
          onPress: async () => {
            try {
              const res = await client.post(`/hosting/needs/${needId}/respond`);
              Alert.alert('Great!', 'The guest has been notified. You can now chat!', [
                { text: 'Open Chat', onPress: () => router.push(`/hosting/chat/${res.data.id}` as any) },
                { text: 'Later', style: 'cancel' },
              ]);
              setNeeds(prev => prev.filter(n => n.id !== needId));
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed to respond');
            }
          },
        },
      ],
    );
  };

  const createOffer = async () => {
    if (!availableFrom || !availableTo) { Alert.alert(t('common.error'), t('hosting.availableFrom')); return; }
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
      Alert.alert(t('hosting.offerCreatedTitle'), t('hosting.offerCreatedMsg'));
      setNotes(''); setKashrut(''); setMaxGuests('2');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

      {/* Open guest needs for this destination */}
      {needsLoading ? (
        <ActivityIndicator size="small" color={C.gold} style={{ marginBottom: 24 }} />
      ) : needs.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.sectionTitle}>🙋 Guests Looking for Hosting ({needs.length})</Text>
          {needs.map(n => (
            <View key={n.id} style={styles.offerCard}>
              <View style={styles.offerTop}>
                <Text style={styles.offerHost}>👤 {n.guest?.firstName ?? 'Guest'}</Text>
                <Text style={styles.offerGuests}>{n.guestsCount} {n.guestsCount !== 1 ? 'guests' : 'guest'}</Text>
              </View>
              <View style={styles.offerTags}>
                {n.forShabbat  && <Tag text={t('hosting.shabbatTag')} />}
                {n.withChildren && <Tag text={t('hosting.childrenOk')} />}
              </View>
              {n.notes && <Text style={styles.offerNotes}>{n.notes}</Text>}
              <Text style={styles.offerDates}>📅 {n.arrivalDate} → {n.departureDate}</Text>
              <TouchableOpacity style={styles.requestBtn} onPress={() => respondToNeed(n.id)}>
                <Text style={styles.requestBtnText}>🏠 I can host them</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.offerCard}>
            <Text style={{ fontSize: 13, color: '#888', textAlign: 'center' }}>
              Want to host more travelers? Create an offer below.
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('hosting.createOfferTitle')}</Text>

      <Text style={styles.label}>{t('hosting.availableFrom')}</Text>
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

      <Text style={styles.label}>{t('hosting.availableUntil')}</Text>
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

      <Text style={styles.label}>{t('hosting.maxGuests')}</Text>
      <TextInput style={styles.input} value={maxGuests} onChangeText={setMaxGuests}
        keyboardType="number-pad" placeholder="2" placeholderTextColor="#999" />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t('hosting.shabbatToggle')}</Text>
        <Switch value={allowsShabbat} onValueChange={setAllowsShabbat} trackColor={{ true: C.navy }} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t('hosting.childrenWelcome')}</Text>
        <Switch value={allowsChildren} onValueChange={setAllowsChildren} trackColor={{ true: C.navy }} />
      </View>

      <Text style={styles.label}>{t('hosting.kashrutOptional')}</Text>
      <TextInput style={styles.input} value={kashrut} onChangeText={setKashrut}
        placeholder="" placeholderTextColor="#999" />

      <Text style={styles.label}>{t('hosting.notesOptional')}</Text>
      <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes}
        placeholder="" placeholderTextColor="#999" multiline />

      <TouchableOpacity style={styles.searchBtn} onPress={createOffer} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.publishOffer')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/hosting/my-requests')}>
        <Text style={styles.outlineBtnText}>{t('hosting.viewRequests')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HostingScreen() {
  const { destinationId, city } = useLocalSearchParams<{ destinationId: string; city?: string }>();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'choose' | 'guest' | 'host'>('choose');
  const cityName = city ? decodeURIComponent(city) : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (mode === 'choose' ? router.back() : setMode('choose'))}
          hitSlop={12}
        >
          <ChevronRight size={20} color="#fff" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>HOSTING</Text>
          <Text style={styles.headerTitle}>{cityName || t('hosting.title')}</Text>
        </View>
      </View>

      {mode === 'choose' && (
        <View style={styles.chooseBody}>
          <Text style={styles.chooseTitle}>{t('hosting.chooseTitle')}</Text>

          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('guest')} activeOpacity={0.82}>
            <View style={[styles.modeIconBox, { backgroundColor: C.goldFaint }]}>
              <Search size={28} color={C.gold} strokeWidth={2} />
            </View>
            <Text style={styles.modeLabel}>{t('hosting.lookingTitle')}</Text>
            <Text style={styles.modeSub}>{t('hosting.lookingDesc')}</Text>
            <View style={styles.modeArrow}>
              <ChevronRight size={18} color={C.textMuted} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('host')} activeOpacity={0.82}>
            <View style={[styles.modeIconBox, { backgroundColor: 'rgba(22,163,74,0.10)' }]}>
              <Home size={28} color="#16A34A" strokeWidth={2} />
            </View>
            <Text style={styles.modeLabel}>{t('hosting.hostTitle')}</Text>
            <Text style={styles.modeSub}>{t('hosting.hostDesc')}</Text>
            <View style={styles.modeArrow}>
              <ChevronRight size={18} color={C.textMuted} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/hosting/my-requests' as any)}>
            <MessageCircle size={16} color={C.navy} strokeWidth={2} />
            <Text style={styles.outlineBtnText}>{t('hosting.myRequests')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'guest' && <GuestView destinationId={Number(destinationId)} />}
      {mode === 'host'  && <HostView  destinationId={Number(destinationId)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', gap: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 26, color: '#fff', letterSpacing: -0.5 },

  // ── Choose screen ──
  chooseBody:  { flex: 1, padding: 20, gap: 14, paddingTop: 28 },
  chooseTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },

  modeCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  modeIconBox:  { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modeLabel:    { fontFamily: 'Inter-Bold', fontSize: 18, color: C.textPrimary, marginBottom: 4 },
  modeSub:      { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textSecondary, lineHeight: 20 },
  modeArrow:    { position: 'absolute', top: 20, right: 16 },

  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: C.navy + '30', backgroundColor: '#fff',
  },
  outlineBtnText: { fontFamily: 'Inter-SemiBold', color: C.navy, fontSize: 15 },

  // ── Shared form styles ──
  body:         { padding: 20, gap: 4 },
  sectionTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary, marginBottom: 16 },
  label:        { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontFamily: 'Inter-Regular', fontSize: 15, borderWidth: 1.5,
    borderColor: '#E5E7EB', color: C.textPrimary, marginBottom: 4,
  },
  toggleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  toggleLabel: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary },

  searchBtn:     { backgroundColor: C.navy, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  searchBtnText: { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16 },

  resultsTitle: { fontFamily: 'Inter-Bold', fontSize: 15, color: C.textPrimary, marginTop: 24, marginBottom: 12 },

  // ── Offer cards ──
  offerCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  offerTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  offerHost:   { fontFamily: 'Inter-Bold', fontSize: 15, color: C.textPrimary },
  offerGuests: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },
  offerTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  offerNotes:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, marginBottom: 6, fontStyle: 'italic' },
  offerDates:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, marginBottom: 10 },

  requestBtn:     { backgroundColor: C.navy, borderRadius: 10, padding: 12, alignItems: 'center' },
  requestBtnText: { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 14 },

  tag:     { backgroundColor: C.goldFaint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.goldBorder },
  tagText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.gold },

  pickerBtn:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 4 },
  pickerBtnText: { fontFamily: 'Inter-Medium', fontSize: 15, color: C.textPrimary },

  empty:     { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 32 },

  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:  { fontFamily: 'Inter-Bold', fontSize: 20, color: C.textPrimary },
  closeBtn:    { fontFamily: 'Inter-Regular', fontSize: 18, color: C.textMuted },
  offerHostLabel: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textSecondary, marginBottom: 16 },
});
