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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, Home, Users, Search, MessageCircle, UserPlus } from 'lucide-react-native';
import client from '@/src/api/client';
import SwipeableSheet from '@/src/components/SwipeableSheet';
import HostingDisclaimerModal from '@/src/components/HostingDisclaimerModal';
import { useAuth } from '@/src/store/auth';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';

// Shared error handler for the 4 endpoints gated on a verified email —
// surfaces a direct path to the verification screen instead of a dead-end alert.
function handleHostingActionError(err: any, email: string | undefined, fallback: string, t: (key: string) => string) {
  const message = err?.response?.data?.message ?? '';
  if (err?.response?.status === 403 && message.toLowerCase().includes('verify your email')) {
    Alert.alert(
      t('hosting.emailVerifyTitle'),
      t('hosting.emailVerifyMsg'),
      [
        { text: t('hosting.cancelBtn'), style: 'cancel' },
        {
          text: t('hosting.verifyNowBtn'),
          onPress: () => router.push({ pathname: '/(auth)/verify-email', params: { email: email ?? '' } } as any),
        },
      ],
    );
  } else {
    Alert.alert(t('common.error'), message || fallback);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type HostingType = 'stay' | 'meals' | 'both';

function getHostingTypeLabel(t: (key: string) => string): Record<HostingType, string> {
  return {
    stay: t('hosting.typeStay'),
    meals: t('hosting.typeMealsOnly'),
    both: t('hosting.typeStayMeals'),
  };
}

function getTypeOptions2(t: (key: string) => string) {
  return [{ value: 'stay' as const, label: t('hosting.typeStay') }, { value: 'meals' as const, label: t('hosting.typeMealsOnly') }];
}

interface Need {
  id: number;
  hostingType: 'stay' | 'meals';
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
  hostingType: HostingType;
  availableFrom: string;
  availableTo: string;
  maxGuests: number;
  allowsChildren: boolean;
  allowsShabbat: boolean;
  kashrutLevel: string | null;
  notes: string | null;
  host: { id: number; firstName: string } | null;
}

interface HostingSummary {
  activeOffers: number;
  openNeeds: number;
  pendingMine: number;
}

function AvatarInitial({ name, color = C.navy }: { name?: string | null; color?: string }) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.avatarInitial, { borderColor: color }]}>
      <Text style={[styles.avatarInitialText, { color }]}>{initial}</Text>
    </View>
  );
}

// ─── Hosting-type selector (2-way for guest/need, 3-way for offers) ───────────

function HostingTypeSelector<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const { i18n } = useTranslation();
  const rtlText = i18n.language === 'he';

  return (
    <View style={[styles.typeSelectorRow, rtlText && styles.typeSelectorRowRtl]}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.typeOption, value === opt.value && styles.typeOptionActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.typeOptionText, rtlText && styles.rtlText, value === opt.value && styles.typeOptionTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Post a Need Modal ────────────────────────────────────────────────────────

function PostNeedModal({ destinationId, defaultHostingType, onClose, onPosted }: { destinationId: number; defaultHostingType?: 'stay' | 'meals'; onClose: () => void; onPosted: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [hostingType, setHostingType]   = useState<'stay' | 'meals'>(defaultHostingType ?? 'stay');
  const [arrivalObj, setArrivalObj]     = useState(new Date());
  const [departureObj, setDepartureObj] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [showArr, setShowArr]           = useState(false);
  const [showDep, setShowDep]           = useState(false);
  const [guests, setGuests]             = useState('1');
  const [shabbat, setShabbat]           = useState(false);
  const [children, setChildren]         = useState(false);
  const [notes, setNotes]               = useState('');
  const [loading, setLoading]           = useState(false);

  const isMeals  = hostingType === 'meals';
  const arrival   = arrivalObj.toISOString().split('T')[0];
  const departure = isMeals ? arrival : departureObj.toISOString().split('T')[0];

  const submit = async () => {
    try {
      setLoading(true);
      await client.post('/hosting/needs', {
        destinationId,
        hostingType,
        arrivalDate: arrival,
        departureDate: departure,
        guestsCount: parseInt(guests, 10) || 1,
        forShabbat: shabbat,
        withChildren: children,
        notes: notes.trim() || undefined,
      });
      Alert.alert(t('hosting.postedTitle'), t('hosting.postedMsg'));
      onPosted();
      onClose();
    } catch (err: any) {
      handleHostingActionError(err, user?.email, t('hosting.failedPost'), t);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UserPlus size={20} color={C.textPrimary} strokeWidth={2} />
              <Text style={styles.sheetTitle}>{t('hosting.postNeedTitle')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            {t('hosting.postNeedDesc')}
          </Text>

          <Text style={styles.label}>{t('hosting.typeLabel')}</Text>
          <HostingTypeSelector
            value={hostingType}
            onChange={setHostingType}
            options={getTypeOptions2(t)}
          />

          <Text style={styles.label}>{isMeals ? t('hosting.shabbatDateLabel') : t('hosting.arrivalDate')}</Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color={C.navy} strokeWidth={2} />
                  <Text style={styles.pickerBtnText}>{arrival}</Text>
                </View>
              </Pressable>
              {showArr && <DateTimePicker value={arrivalObj} mode="date" minimumDate={new Date()}
                onChange={(_, d) => { setShowArr(false); if (d) setArrivalObj(d); }} />}
            </>
          )}

          {!isMeals && (
            <>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Calendar size={16} color={C.navy} strokeWidth={2} />
                      <Text style={styles.pickerBtnText}>{departure}</Text>
                    </View>
                  </Pressable>
                  {showDep && <DateTimePicker value={departureObj} mode="date" minimumDate={arrivalObj}
                    onChange={(_, d) => { setShowDep(false); if (d) setDepartureObj(d); }} />}
                </>
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

          <Text style={styles.label}>{t('hosting.notesOptional')}</Text>
          <TextInput style={[styles.input, { height: 60 }]} value={notes} onChangeText={setNotes}
            placeholder={t('hosting.specialReqPlaceholder')} placeholderTextColor="#999" multiline />

          <TouchableOpacity style={styles.searchBtn} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.postRequestBtn')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

// ─── Guest search form + results ─────────────────────────────────────────────

function GuestView({ destinationId }: { destinationId: number }) {
  const { t, i18n } = useTranslation();
  const HOSTING_TYPE_LABEL = getHostingTypeLabel(t);
  const [hostingType, setHostingType]     = useState<'stay' | 'meals'>('stay');
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
  const rtlText = i18n.language === 'he';

  const search = async (options?: { silent?: boolean }) => {
    try {
      setLoading(true);
      const params: any = { destinationId, hostingType };
      if (arrivalDate)   params.arrivalDate   = arrivalDate;
      if (departureDate) params.departureDate = departureDate;
      if (guestsCount)   params.guestsCount   = guestsCount;
      if (forShabbat)    params.forShabbat    = 'true';
      if (withChildren)  params.withChildren  = 'true';
      const res = await client.get('/hosting/offers/search', { params });
      setOffers(res.data);
    } catch {
      if (!options?.silent) {
        Alert.alert(t('common.error'), t('common.retry'));
      } else {
        setOffers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search({ silent: true });
    // Initial discovery list for this destination; user can refine it with the form below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationId]);

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, rtlText && styles.rtlText]}>{t('hosting.availableOffersTitle')}</Text>

      {loading && offers === null ? (
        <ActivityIndicator size="small" color={C.gold} style={{ marginBottom: 18 }} />
      ) : offers && offers.length > 0 ? (
        <FlatList
          horizontal
          inverted
          data={offers}
          keyExtractor={(offer) => String(offer.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item: offer }) => (
            <TouchableOpacity style={styles.compactCard} onPress={() => setRequestOffer(offer)} activeOpacity={0.86}>
              <View style={[styles.compactTop, rtlText && styles.compactTopRtl]}>
                <AvatarInitial name={offer.host?.firstName} color={C.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.compactTitle, rtlText && styles.rtlText]}>{offer.host?.firstName ?? t('hosting.hostLabel')}</Text>
                  <Text style={[styles.compactMeta, rtlText && styles.rtlText]}>{t('hosting.upToGuests')} {offer.maxGuests} {t('hosting.guests')}</Text>
                </View>
              </View>
              <View style={[styles.offerTags, rtlText && styles.offerTagsRtl]}>
                <Tag text={HOSTING_TYPE_LABEL[offer.hostingType]} />
                {offer.allowsShabbat && <Tag text={t('hosting.shabbatTag')} />}
                {offer.allowsChildren && <Tag text={t('hosting.childrenOk')} />}
              </View>
              <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
                <Calendar size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={[styles.offerDates, rtlText && styles.rtlText]}>{offer.availableFrom} - {offer.availableTo}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.inlineEmpty}>
          <Text style={styles.inlineEmptyText}>{t('hosting.noHosts')}</Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 18 }, rtlText && styles.rtlText]}>{t('hosting.postNeedTitle')}</Text>

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.typeLabel')}</Text>
      <HostingTypeSelector
        value={hostingType}
        onChange={setHostingType}
        options={getTypeOptions2(t)}
      />

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.arrivalDate')}</Text>
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
            <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
              <Calendar size={16} color={C.navy} strokeWidth={2} />
              <Text style={styles.pickerBtnText}>{arrivalDate}</Text>
            </View>
          </Pressable>
          {showArrival && (
            <DateTimePicker value={arrivalObj} mode="date" minimumDate={new Date()}
              onChange={(_, d) => { setShowArrival(false); if (d) setArrivalObj(d); }} />
          )}
        </>
      )}

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.departureDate')}</Text>
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
            <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
              <Calendar size={16} color={C.navy} strokeWidth={2} />
              <Text style={styles.pickerBtnText}>{departureDate}</Text>
            </View>
          </Pressable>
          {showDeparture && (
            <DateTimePicker value={departureObj} mode="date" minimumDate={arrivalObj}
              onChange={(_, d) => { setShowDeparture(false); if (d) setDepartureObj(d); }} />
          )}
        </>
      )}

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.numberOfGuests')}</Text>
      <TextInput style={[styles.input, rtlText && styles.rtlText]} value={guestsCount} onChangeText={setGuestsCount}
        keyboardType="number-pad" placeholder="1" placeholderTextColor="#999" />

      <View style={[styles.toggleRow, rtlText && styles.toggleRowRtl]}>
        <Text style={[styles.toggleLabel, rtlText && styles.rtlText]}>{t('hosting.shabbatToggle')}</Text>
        <Switch value={forShabbat} onValueChange={setForShabbat} trackColor={{ true: C.navy }} />
      </View>
      <View style={[styles.toggleRow, rtlText && styles.toggleRowRtl]}>
        <Text style={[styles.toggleLabel, rtlText && styles.rtlText]}>{t('hosting.withChildren')}</Text>
        <Switch value={withChildren} onValueChange={setWithChildren} trackColor={{ true: C.navy }} />
      </View>

      <TouchableOpacity style={styles.searchBtn} onPress={() => search()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.searchBtn')}</Text>}
      </TouchableOpacity>

      {/* No results — offer to post a need */}
      {offers !== null && offers.length === 0 && (
        <View style={styles.empty}>
          <Home size={48} color="#E5E7EB" strokeWidth={1.5} />
          <Text style={styles.emptyText}>{t('hosting.noHosts')}</Text>
          <TouchableOpacity style={[styles.searchBtn, { marginTop: 16, flexDirection: 'row', gap: 8, alignItems: 'center' }]} onPress={() => setPostNeedVisible(true)}>
            <UserPlus size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.searchBtnText}>{t('hosting.postHostingRequestBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Always show "post a need" option after results */}
      {offers !== null && offers.length > 0 && (
        <TouchableOpacity style={[styles.outlineBtn, rtlText && styles.rowRtl]} onPress={() => setPostNeedVisible(true)}>
          <UserPlus size={15} color={C.navy} strokeWidth={2} />
          <Text style={styles.outlineBtnText}>{t('hosting.noMatchPostRequest')}</Text>
        </TouchableOpacity>
      )}

      {requestOffer && (
        <SendRequestModal
          offer={requestOffer}
          onClose={() => setRequestOffer(null)}
          defaultHostingType={hostingType}
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
          defaultHostingType={hostingType}
          onClose={() => setPostNeedVisible(false)}
          onPosted={() => {}}
        />
      )}
    </ScrollView>
  );
}

// ─── Send Request Modal ───────────────────────────────────────────────────────

function SendRequestModal({
  offer, onClose, defaultHostingType, defaultArrival, defaultDeparture,
  defaultGuests, defaultShabbat, defaultChildren,
}: {
  offer: Offer; onClose: () => void; defaultHostingType: 'stay' | 'meals';
  defaultArrival: string; defaultDeparture: string;
  defaultGuests: string; defaultShabbat: boolean; defaultChildren: boolean;
}) {
  // If the offer only supports one type, lock the request to that type
  const [hostingType, setHostingType] = useState<'stay' | 'meals'>(
    offer.hostingType === 'both' ? defaultHostingType : offer.hostingType,
  );
  const [arrivalObj, setArrivalObj]   = useState(() => defaultArrival ? new Date(defaultArrival) : new Date());
  const [departObj, setDepartObj]     = useState(() => defaultDeparture ? new Date(defaultDeparture) : new Date());
  const [showArr, setShowArr]         = useState(false);
  const [showDep, setShowDep]         = useState(false);
  const [guests, setGuests]           = useState(defaultGuests);
  const [shabbat, setShabbat]         = useState(defaultShabbat);
  const [children, setChildren]       = useState(defaultChildren);
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const HOSTING_TYPE_LABEL = getHostingTypeLabel(t);
  const rtlText = i18n.language === 'he';

  const isMeals   = hostingType === 'meals';
  const arrival   = arrivalObj.toISOString().split('T')[0];
  const departure = isMeals ? arrival : departObj.toISOString().split('T')[0];

  const send = async () => {
    if (!arrival || !departure) { Alert.alert(t('common.error'), t('hosting.arrivalDate')); return; }
    try {
      setLoading(true);
      await client.post('/hosting/requests', {
        offerId: offer.id,
        hostingType,
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
      handleHostingActionError(err, user?.email, t('hosting.failedSendRequest'), t);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableSheet visible onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={[styles.sheetHeader, rtlText && styles.sheetHeaderRtl]}>
            <View style={[styles.sheetIdentity, rtlText && styles.sheetIdentityRtl]}>
              <AvatarInitial name={offer.host?.firstName} color={C.navy} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, rtlText && styles.rtlText]}>{offer.host?.firstName ?? t('hosting.hostLabel')}</Text>
                <Text style={[styles.offerHostLabel, rtlText && styles.rtlText]}>{t('hosting.requestTitle')}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
          </View>

          <View style={[styles.offerTags, rtlText && styles.offerTagsRtl]}>
            <Tag text={HOSTING_TYPE_LABEL[offer.hostingType]} />
            {offer.allowsShabbat && <Tag text={t('hosting.shabbatTag')} />}
            {offer.allowsChildren && <Tag text={t('hosting.childrenOk')} />}
          </View>

          <View style={[styles.sheetInfoRow, rtlText && styles.sheetInfoRowRtl]}>
            <Users size={15} color={C.textMuted} strokeWidth={2} />
            <Text style={[styles.sheetInfoText, rtlText && styles.rtlText]}>
              {t('hosting.upToGuests')} {offer.maxGuests} {t('hosting.guests')}
            </Text>
          </View>
          <View style={[styles.sheetInfoRow, rtlText && styles.sheetInfoRowRtl]}>
            <Calendar size={15} color={C.textMuted} strokeWidth={2} />
            <Text style={[styles.sheetInfoText, rtlText && styles.rtlText]}>{offer.availableFrom} - {offer.availableTo}</Text>
          </View>

          {offer.kashrutLevel ? (
            <Text style={[styles.sheetNotes, rtlText && styles.rtlText]}>{offer.kashrutLevel}</Text>
          ) : null}
          {offer.notes ? (
            <Text style={[styles.sheetNotes, rtlText && styles.rtlText]}>{offer.notes}</Text>
          ) : null}

          {offer.hostingType === 'both' ? (
            <>
              <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.typeLabel')}</Text>
              <HostingTypeSelector
                value={hostingType}
                onChange={setHostingType}
                options={getTypeOptions2(t)}
              />
            </>
          ) : null}

          <Text style={[styles.label, rtlText && styles.rtlText]}>{isMeals ? t('hosting.shabbatDateLabel') : t('hosting.arrivalDate')}</Text>
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
                <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
                  <Calendar size={16} color={C.navy} strokeWidth={2} />
                  <Text style={styles.pickerBtnText}>{arrival}</Text>
                </View>
              </Pressable>
              {showArr && (
                <DateTimePicker value={arrivalObj} mode="date" minimumDate={new Date()}
                  onChange={(_, d) => { setShowArr(false); if (d) setArrivalObj(d); }} />
              )}
            </>
          )}

          {!isMeals && (
            <>
              <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.departureDate')}</Text>
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
                    <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
                      <Calendar size={16} color={C.navy} strokeWidth={2} />
                      <Text style={styles.pickerBtnText}>{departure}</Text>
                    </View>
                  </Pressable>
                  {showDep && (
                    <DateTimePicker value={departObj} mode="date" minimumDate={arrivalObj}
                      onChange={(_, d) => { setShowDep(false); if (d) setDepartObj(d); }} />
                  )}
                </>
              )}
            </>
          )}

          <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.numberOfGuests')}</Text>
          <TextInput style={[styles.input, rtlText && styles.rtlText]} value={guests} onChangeText={setGuests} keyboardType="number-pad" />

          <View style={[styles.toggleRow, rtlText && styles.toggleRowRtl]}>
            <Text style={[styles.toggleLabel, rtlText && styles.rtlText]}>{t('hosting.forShabbat')}</Text>
            <Switch value={shabbat} onValueChange={setShabbat} trackColor={{ true: C.navy }} />
          </View>
          <View style={[styles.toggleRow, rtlText && styles.toggleRowRtl]}>
            <Text style={[styles.toggleLabel, rtlText && styles.rtlText]}>{t('hosting.withChildren')}</Text>
            <Switch value={children} onValueChange={setChildren} trackColor={{ true: C.navy }} />
          </View>

          <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.specialRequests')}</Text>
          <TextInput style={[styles.input, { height: 70 }, rtlText && styles.rtlText]} value={notes} onChangeText={setNotes}
            placeholder={t('hosting.specialReqPlaceholder')} placeholderTextColor="#999" multiline />

          <TouchableOpacity style={styles.searchBtn} onPress={send} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.sendRequest')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SwipeableSheet>
  );
}

function NeedDetailsSheet({
  need,
  onClose,
  onRespond,
  loading,
}: {
  need: Need;
  onClose: () => void;
  onRespond: () => void;
  loading: boolean;
}) {
  const { t, i18n } = useTranslation();
  const HOSTING_TYPE_LABEL = getHostingTypeLabel(t);
  const rtlText = i18n.language === 'he';

  return (
    <SwipeableSheet visible onClose={onClose}>
      <View style={styles.sheet}>
        <View style={[styles.sheetHeader, rtlText && styles.sheetHeaderRtl]}>
          <View style={[styles.sheetIdentity, rtlText && styles.sheetIdentityRtl]}>
            <AvatarInitial name={need.guest?.firstName} color={C.typeParve} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, rtlText && styles.rtlText]}>{need.guest?.firstName ?? t('hosting.guest')}</Text>
              <Text style={[styles.offerHostLabel, rtlText && styles.rtlText]}>{t('hosting.needDetailsTitle')}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeBtn}>✕</Text></Pressable>
        </View>

        <View style={[styles.offerTags, rtlText && styles.offerTagsRtl]}>
          <Tag text={HOSTING_TYPE_LABEL[need.hostingType]} />
          {need.forShabbat && <Tag text={t('hosting.shabbatTag')} />}
          {need.withChildren && <Tag text={t('hosting.childrenOk')} />}
        </View>

        <View style={[styles.sheetInfoRow, rtlText && styles.sheetInfoRowRtl]}>
          <Users size={15} color={C.textMuted} strokeWidth={2} />
          <Text style={[styles.sheetInfoText, rtlText && styles.rtlText]}>
            {need.guestsCount} {need.guestsCount !== 1 ? t('hosting.guests') : t('hosting.guest')}
          </Text>
        </View>
        <View style={[styles.sheetInfoRow, rtlText && styles.sheetInfoRowRtl]}>
          <Calendar size={15} color={C.textMuted} strokeWidth={2} />
          <Text style={[styles.sheetInfoText, rtlText && styles.rtlText]}>{need.arrivalDate} - {need.departureDate}</Text>
        </View>

        {need.notes ? <Text style={[styles.sheetNotes, rtlText && styles.rtlText]}>{need.notes}</Text> : null}

        <TouchableOpacity style={styles.searchBtn} onPress={onRespond} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{t('hosting.iCanHostBtn')}</Text>}
        </TouchableOpacity>
      </View>
    </SwipeableSheet>
  );
}

// ─── Host view — create offer + see requests ──────────────────────────────────

function HostView({ destinationId, city, editOfferId }: { destinationId: number; city?: string; editOfferId?: number }) {
  const { t, i18n } = useTranslation();
  const HOSTING_TYPE_LABEL = getHostingTypeLabel(t);
  const { user } = useAuth();
  const rtlText = i18n.language === 'he';
  const [needs, setNeeds]                   = useState<Need[]>([]);
  const [needsLoading, setNeedsLoading]     = useState(!editOfferId);
  const [hostingType, setHostingType]       = useState<HostingType>('both');
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
  const [loadingEdit, setLoadingEdit]       = useState(!!editOfferId);
  const [selectedNeed, setSelectedNeed]     = useState<Need | null>(null);
  const [respondingNeedId, setRespondingNeedId] = useState<number | null>(null);

  useEffect(() => {
    if (editOfferId) return; // editing an existing offer — no need for open needs
    setNeedsLoading(true);
    client.get('/hosting/needs', { params: { destinationId } })
      .then(res => setNeeds(res.data))
      .catch(() => Alert.alert(t('common.error'), t('common.retry')))
      .finally(() => setNeedsLoading(false));
  }, [destinationId, editOfferId]);

  useEffect(() => {
    if (!editOfferId) return;
    client.get(`/hosting/offers/${editOfferId}`)
      .then(res => {
        const o = res.data;
        setHostingType(o.hostingType);
        setFromObj(new Date(o.availableFrom));
        setToObj(new Date(o.availableTo));
        setMaxGuests(String(o.maxGuests));
        setAllowsShabbat(o.allowsShabbat);
        setAllowsChildren(o.allowsChildren);
        setKashrut(o.kashrutLevel ?? '');
        setNotes(o.notes ?? '');
      })
      .catch(() => Alert.alert(t('common.error'), t('hosting.loadOfferError')))
      .finally(() => setLoadingEdit(false));
  }, [editOfferId]);

  const respondToNeed = async (needId: number) => {
    try {
      setRespondingNeedId(needId);
      await client.post(`/hosting/needs/${needId}/respond`);
      Alert.alert(t('hosting.greatTitle'), t('hosting.notifiedMsg'));
      setNeeds(prev => prev.filter(n => n.id !== needId));
      setSelectedNeed(null);
    } catch (err: any) {
      handleHostingActionError(err, user?.email, t('hosting.failedRespond'), t);
    } finally {
      setRespondingNeedId(null);
    }
  };

  const saveOffer = async () => {
    if (!availableFrom || !availableTo) { Alert.alert(t('common.error'), t('hosting.availableFrom')); return; }
    try {
      setLoading(true);
      if (editOfferId) {
        // No destinationId here — the backend's ValidationPipe (forbidNonWhitelisted)
        // rejects unknown fields, and UpdateOfferDto doesn't accept destination changes.
        // kashrutLevel/notes are sent as-is (possibly '') so clearing a field on edit
        // actually clears it, instead of being dropped as undefined and ignored.
        await client.patch(`/hosting/offers/${editOfferId}`, {
          hostingType,
          availableFrom,
          availableTo,
          maxGuests: parseInt(maxGuests, 10) || 1,
          allowsShabbat,
          allowsChildren,
          kashrutLevel: kashrut.trim(),
          notes: notes.trim(),
        });
        Alert.alert(t('hosting.updatedTitle'), t('hosting.updatedMsg'));
        router.push('/hosting/my-offers' as any);
      } else {
        await client.post('/hosting/offers', {
          destinationId,
          hostingType,
          availableFrom,
          availableTo,
          maxGuests: parseInt(maxGuests, 10) || 1,
          allowsShabbat,
          allowsChildren,
          kashrutLevel: kashrut.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        Alert.alert(t('hosting.offerCreatedTitle'), t('hosting.offerCreatedMsg'));
        setNotes(''); setKashrut(''); setMaxGuests('2'); setHostingType('both');
      }
    } catch (err: any) {
      if (err?.response?.status === 409 && err.response.data?.offerId) {
        Alert.alert(
          t('hosting.overlappingOfferTitle'),
          err.response.data?.message ?? t('hosting.overlappingOfferFallback'),
          [
            { text: t('hosting.cancelBtn'), style: 'cancel' },
            {
              text: t('hosting.editExistingOfferBtn'),
              onPress: () => router.push({
                pathname: '/hosting/[destinationId]',
                params: { destinationId: String(destinationId), mode: 'host', editOfferId: String(err.response.data.offerId) },
              } as any),
            },
          ],
        );
      } else {
        handleHostingActionError(err, user?.email, editOfferId ? t('hosting.failedUpdateOffer') : t('hosting.failedCreateOffer'), t);
      }
    } finally {
      setLoading(false);
    }
  };

  if (editOfferId && loadingEdit) {
    return (
      <View style={[styles.body, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

      {/* Open guest needs for this destination — not relevant while editing an existing offer */}
      {editOfferId ? null : (
        <View style={{ marginBottom: 18 }}>
          <View style={[styles.sectionHeaderRow, rtlText && styles.sectionHeaderRowRtl]}>
            <Users size={16} color={C.textPrimary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }, rtlText && styles.rtlText]}>{t('hosting.guestsLookingTitle')} ({needs.length})</Text>
          </View>

          {needsLoading ? (
            <ActivityIndicator size="small" color={C.gold} style={{ marginBottom: 16 }} />
          ) : needs.length > 0 ? (
            <FlatList
              horizontal
              inverted
              data={needs}
              keyExtractor={(need) => String(need.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item: n }) => (
                <TouchableOpacity style={styles.compactCard} onPress={() => setSelectedNeed(n)} activeOpacity={0.86}>
                  <View style={[styles.compactTop, rtlText && styles.compactTopRtl]}>
                    <AvatarInitial name={n.guest?.firstName} color={C.typeParve} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.compactTitle, rtlText && styles.rtlText]}>{n.guest?.firstName ?? t('hosting.guest')}</Text>
                      <Text style={[styles.compactMeta, rtlText && styles.rtlText]}>
                        {n.guestsCount} {n.guestsCount !== 1 ? t('hosting.guests') : t('hosting.guest')}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.offerTags, rtlText && styles.offerTagsRtl]}>
                    <Tag text={HOSTING_TYPE_LABEL[n.hostingType]} />
                    {n.forShabbat && <Tag text={t('hosting.shabbatTag')} />}
                    {n.withChildren && <Tag text={t('hosting.childrenOk')} />}
                  </View>
                  {n.notes ? <Text style={[styles.compactNotes, rtlText && styles.rtlText]} numberOfLines={2}>{n.notes}</Text> : null}
                  <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
                    <Calendar size={13} color={C.textMuted} strokeWidth={2} />
                    <Text style={[styles.offerDates, rtlText && styles.rtlText]}>{n.arrivalDate} - {n.departureDate}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.inlineEmpty}>
              <Text style={styles.inlineEmptyText}>{t('hosting.noOpenNeeds')}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={[styles.sectionTitle, rtlText && styles.rtlText]}>{editOfferId ? t('hosting.editOfferTitle') : t('hosting.createOfferTitle')}</Text>

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.typeLabel')}</Text>
      <HostingTypeSelector
        value={hostingType}
        onChange={setHostingType}
        options={[
          { value: 'stay', label: t('hosting.typeStay') },
          { value: 'meals', label: t('hosting.typeMealsOnly') },
          { value: 'both', label: t('hosting.typeBoth') },
        ]}
      />

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.availableFrom')}</Text>
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
            <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
              <Calendar size={16} color={C.navy} strokeWidth={2} />
              <Text style={styles.pickerBtnText}>{availableFrom}</Text>
            </View>
          </Pressable>
          {showFrom && (
            <DateTimePicker value={fromObj} mode="date" minimumDate={new Date()}
              onChange={(_, d) => { setShowFrom(false); if (d) setFromObj(d); }} />
          )}
        </>
      )}

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.availableUntil')}</Text>
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
            <View style={[styles.dateRow, rtlText && styles.rowRtl]}>
              <Calendar size={16} color={C.navy} strokeWidth={2} />
              <Text style={styles.pickerBtnText}>{availableTo}</Text>
            </View>
          </Pressable>
          {showTo && (
            <DateTimePicker value={toObj} mode="date" minimumDate={fromObj}
              onChange={(_, d) => { setShowTo(false); if (d) setToObj(d); }} />
          )}
        </>
      )}

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.maxGuests')}</Text>
      <TextInput style={[styles.input, rtlText && styles.rtlText]} value={maxGuests} onChangeText={setMaxGuests}
        keyboardType="number-pad" placeholder="2" placeholderTextColor="#999" />

      <View style={[styles.toggleRow, rtlText && styles.toggleRowRtl]}>
        <Text style={[styles.toggleLabel, rtlText && styles.rtlText]}>{t('hosting.shabbatToggle')}</Text>
        <Switch value={allowsShabbat} onValueChange={setAllowsShabbat} trackColor={{ true: C.navy }} />
      </View>
      <View style={[styles.toggleRow, rtlText && styles.toggleRowRtl]}>
        <Text style={[styles.toggleLabel, rtlText && styles.rtlText]}>{t('hosting.childrenWelcome')}</Text>
        <Switch value={allowsChildren} onValueChange={setAllowsChildren} trackColor={{ true: C.navy }} />
      </View>

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.kashrutOptional')}</Text>
      <TextInput style={[styles.input, rtlText && styles.rtlText]} value={kashrut} onChangeText={setKashrut}
        placeholder="" placeholderTextColor="#999" />

      <Text style={[styles.label, rtlText && styles.rtlText]}>{t('hosting.notesOptional')}</Text>
      <TextInput style={[styles.input, { height: 70 }, rtlText && styles.rtlText]} value={notes} onChangeText={setNotes}
        placeholder="" placeholderTextColor="#999" multiline />

      <TouchableOpacity style={styles.searchBtn} onPress={saveOffer} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>{editOfferId ? t('hosting.saveChangesBtn') : t('hosting.publishOffer')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.outlineBtn}
        onPress={() => {
          if (editOfferId) {
            router.push('/hosting/my-offers' as any);
            return;
          }
          router.push({
            pathname: '/hosting/my-requests',
            params: {
              destinationId: String(destinationId),
              ...(city ? { city } : {}),
            },
          } as any);
        }}
      >
        <Text style={styles.outlineBtnText}>{editOfferId ? t('hosting.cancelBtn') : t('hosting.viewRequests')}</Text>
      </TouchableOpacity>

      {selectedNeed && (
        <NeedDetailsSheet
          need={selectedNeed}
          onClose={() => setSelectedNeed(null)}
          onRespond={() => respondToNeed(selectedNeed.id)}
          loading={respondingNeedId === selectedNeed.id}
        />
      )}
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

function HostingScreen() {
  const { destinationId, city, mode: modeParam, editOfferId } = useLocalSearchParams<{
    destinationId: string; city?: string; mode?: string; editOfferId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'choose' | 'guest' | 'host'>(modeParam === 'host' || modeParam === 'guest' ? modeParam : 'choose');
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);
  const [summary, setSummary] = useState<HostingSummary | null>(null);
  const cityName = city ? decodeURIComponent(city) : '';
  const numericDestinationId = Number(destinationId);
  const routeMode = modeParam === 'host' || modeParam === 'guest' ? modeParam : undefined;
  const rtlText = i18n.language === 'he';

  useEffect(() => {
    AsyncStorage.getItem('hostingDisclaimerAccepted').then((v) => {
      if (v !== 'true') setDisclaimerVisible(true);
    });
  }, []);

  useEffect(() => {
    setMode(routeMode ?? 'choose');
  }, [routeMode]);

  useEffect(() => {
    client.get('/hosting/summary', { params: { destinationId: numericDestinationId } })
      .then(res => setSummary(res.data))
      .catch(() => setSummary(null));
  }, [numericDestinationId]);

  const acceptDisclaimer = () => {
    AsyncStorage.setItem('hostingDisclaimerAccepted', 'true');
    setDisclaimerVisible(false);
  };

  const openMode = (nextMode: 'guest' | 'host') => {
    router.push({
      pathname: '/hosting/[destinationId]',
      params: {
        destinationId,
        ...(city ? { city } : {}),
        mode: nextMode,
      },
    } as any);
  };

  const goBackFromHeader = () => {
    if (mode === 'choose') {
      router.back();
    } else if (routeMode) {
      router.back();
    } else {
      setMode('choose');
    }
  };

  return (
    <View style={styles.container}>
      <HostingDisclaimerModal visible={disclaimerVisible} onAccept={acceptDisclaimer} />
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={goBackFromHeader}
          hitSlop={12}
        >
          <ChevronRight size={20} color={C.navy} strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View style={styles.hostingHeaderTextBlock}>
          <Text style={styles.eyebrow}>{t('hosting.eyebrow')}</Text>
          <Text style={styles.headerTitle}>{cityName || t('hosting.title')}</Text>
          <Pressable onPress={() => setDisclaimerVisible(true)} hitSlop={12} style={[styles.safetyLinkBtn, rtlText && styles.safetyLinkBtnRtl]}>
            <Text style={styles.safetyLink}>{t('hosting.safetyRulesLink')}</Text>
          </Pressable>
        </View>
      </View>

      {mode === 'choose' && (
        <View style={styles.chooseBody}>
          <View style={styles.hubIntro}>
            <Text style={styles.hubTitle}>{t('hosting.hubTitle')}</Text>
            <Text style={styles.hubSub}>{t('hosting.hubSubtitle')}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{summary?.activeOffers ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('hosting.statAvailableHosts')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{summary?.openNeeds ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('hosting.statLookingGuests')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{summary?.pendingMine ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('hosting.statPendingMine')}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.chooseTitle, rtlText && styles.rtlText]}>{t('hosting.chooseActionTitle')}</Text>

          <TouchableOpacity style={styles.modeCard} onPress={() => openMode('guest')} activeOpacity={0.82}>
            <View style={[styles.modeIconBox, { backgroundColor: C.goldFaint }, rtlText && styles.modeIconBoxRtl]}>
              <Search size={28} color={C.gold} strokeWidth={2} />
            </View>
            <Text style={[styles.modeLabel, rtlText && styles.rtlText]}>{t('hosting.lookingTitle')}</Text>
            <Text style={[styles.modeSub, rtlText && styles.rtlText]}>{t('hosting.lookingDesc')}</Text>
            <View style={[styles.modeArrow, rtlText && styles.modeArrowRtl]}>
              <ChevronRight size={18} color={C.textMuted} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => openMode('host')} activeOpacity={0.82}>
            <View style={[styles.modeIconBox, { backgroundColor: C.typeParveBg }, rtlText && styles.modeIconBoxRtl]}>
              <Home size={28} color={C.typeParve} strokeWidth={2} />
            </View>
            <Text style={[styles.modeLabel, rtlText && styles.rtlText]}>{t('hosting.hostTitle')}</Text>
            <Text style={[styles.modeSub, rtlText && styles.rtlText]}>{t('hosting.hostDesc')}</Text>
            <View style={[styles.modeArrow, rtlText && styles.modeArrowRtl]}>
              <ChevronRight size={18} color={C.textMuted} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => router.push({
              pathname: '/hosting/my-requests',
              params: {
                destinationId: String(numericDestinationId),
                ...(city ? { city } : {}),
              },
            } as any)}
          >
            <MessageCircle size={16} color={C.navy} strokeWidth={2} />
            <Text style={styles.outlineBtnText}>{t('hosting.myActivity')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'guest' && <GuestView destinationId={numericDestinationId} />}
      {mode === 'host'  && <HostView  destinationId={numericDestinationId} city={city} editOfferId={editOfferId ? Number(editOfferId) : undefined} />}
    </View>
  );
}

export default withProtectedRoute(HostingScreen, 'hosting');

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 22, paddingHorizontal: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    bottom: 22,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.goldBorder,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldEyebrow, letterSpacing: 2.5, marginBottom: 2, textAlign: 'center' },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 30, color: C.navy, textAlign: 'center' },
  hostingHeaderTextBlock: { alignItems: 'center', minWidth: 0, maxWidth: '100%' },
  safetyLinkBtn: { alignSelf: 'center', marginTop: 4 },
  safetyLinkBtnRtl: { alignSelf: 'center' },
  safetyLink: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.goldEyebrow, textDecorationLine: 'underline', textAlign: 'center' },

  // ── Choose screen ──
  chooseBody:  { flex: 1, padding: 20, gap: 14, paddingTop: 28 },
  chooseTitle: { fontFamily: 'Inter-Bold', fontSize: 13, color: C.goldEyebrow, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },

  hubIntro: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
    marginBottom: 12,
  },
  hubTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 24,
    color: C.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  hubSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.goldBorder,
    backgroundColor: C.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 66,
  },
  statValue: { fontFamily: 'Inter-Black', fontSize: 22, color: C.navy, lineHeight: 26 },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 4 },

  modeCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  modeIconBox:  { width: 52, height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modeIconBoxRtl: { alignSelf: 'flex-end' },
  modeLabel:    { fontFamily: 'Inter-Bold', fontSize: 18, color: C.textPrimary, marginBottom: 4 },
  modeSub:      { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textSecondary, lineHeight: 20 },
  modeArrow:    { position: 'absolute', top: 20, right: 16 },
  modeArrowRtl: { left: 16, right: undefined },
  rtlText:      { textAlign: 'right', writingDirection: 'rtl' },

  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 8, paddingVertical: 14,
    borderWidth: 1.5, borderColor: C.goldBorder, backgroundColor: '#fff',
  },
  outlineBtnText: { fontFamily: 'Inter-SemiBold', color: C.navy, fontSize: 15 },

  // ── Shared form styles ──
  body:         { padding: 20, gap: 4 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeaderRowRtl: { flexDirection: 'row-reverse' },
  sectionTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary, marginBottom: 16 },
  label:        { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    fontFamily: 'Inter-Regular', fontSize: 15, borderWidth: 1.5,
    borderColor: 'rgba(11,23,54,0.10)', color: C.textPrimary, marginBottom: 4,
  },
  toggleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(11,23,54,0.07)' },
  toggleRowRtl:{ flexDirection: 'row-reverse' },
  toggleLabel: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary },

  typeSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeSelectorRowRtl: { flexDirection: 'row-reverse' },
  typeOption: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(11,23,54,0.10)', backgroundColor: '#fff',
    alignItems: 'center',
  },
  typeOptionActive:    { backgroundColor: C.navy, borderColor: C.navy },
  typeOptionText:      { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.textSecondary },
  typeOptionTextActive:{ color: '#fff' },

  searchBtn:     { backgroundColor: C.navy, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  searchBtnText: { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 16 },

  resultsTitle: { fontFamily: 'Inter-Bold', fontSize: 15, color: C.textPrimary, marginTop: 24, marginBottom: 12 },

  horizontalList: { gap: 12, paddingBottom: 12, paddingHorizontal: 2 },
  compactCard: {
    width: 218,
    minHeight: 150,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  compactTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  compactTopRtl: { flexDirection: 'row-reverse' },
  compactTitle: { fontFamily: 'Inter-Bold', fontSize: 15, color: C.textPrimary },
  compactMeta: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 2 },
  compactNotes: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 8 },
  avatarInitial: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: { fontFamily: 'Inter-Bold', fontSize: 14 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineEmpty: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    marginBottom: 12,
  },
  inlineEmptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

  // ── Offer cards ──
  offerCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  offerTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  offerHost:   { fontFamily: 'Inter-Bold', fontSize: 15, color: C.textPrimary },
  offerGuests: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },
  offerTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  offerTagsRtl:{ flexDirection: 'row-reverse' },
  offerNotes:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, marginBottom: 6, fontStyle: 'italic' },
  offerDates:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, marginBottom: 10 },

  requestBtn:     { backgroundColor: C.navy, borderRadius: 12, padding: 12, alignItems: 'center' },
  requestBtnText: { fontFamily: 'Inter-Bold', color: '#fff', fontSize: 14 },

  tag:     { backgroundColor: C.kashrutGoldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.goldBorder },
  tagText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.kashrutGold },

  pickerBtn:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(11,23,54,0.10)', marginBottom: 4 },
  pickerBtnText: { fontFamily: 'Inter-Medium', fontSize: 15, color: C.textPrimary },
  rowRtl:         { flexDirection: 'row-reverse' },

  empty:     { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 32 },

  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetHeaderRtl: { flexDirection: 'row-reverse' },
  sheetIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sheetIdentityRtl: { flexDirection: 'row-reverse' },
  sheetTitle:  { fontFamily: 'Inter-Bold', fontSize: 20, color: C.textPrimary },
  closeBtn:    { fontFamily: 'Inter-Regular', fontSize: 18, color: C.textMuted },
  offerHostLabel: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textSecondary, marginBottom: 16 },
  sheetInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sheetInfoRowRtl: { flexDirection: 'row-reverse' },
  sheetInfoText: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textSecondary },
  sheetNotes: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 22,
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.06)',
  },
});
