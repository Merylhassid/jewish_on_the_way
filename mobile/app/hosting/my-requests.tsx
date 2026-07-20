import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, Home, MessageCircle, Pencil, Users, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
type HostingType = 'stay' | 'meals' | 'both';
type ActivityTab = 'attention' | 'matches' | 'requests' | 'offers';

interface HostingRequest {
  id: number;
  status: RequestStatus;
  hostingType: 'stay' | 'meals';
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  specialRequests?: string;
  destination: { id: number; city: string } | null;
  guest: { id: number; firstName: string; lastName?: string; email?: string } | null;
  offer: { id: number } | null;
  overlapWarning?: { guestName: string; arrivalDate: string; departureDate: string } | null;
}

interface HostingNeed {
  id: number;
  hostingType: 'stay' | 'meals';
  arrivalDate: string;
  departureDate: string;
  guestsCount: number;
  withChildren: boolean;
  forShabbat: boolean;
  notes?: string;
  isOpen: boolean;
  destination: { id: number; city: string } | null;
}

interface HostingOffer {
  id: number;
  hostingType: HostingType;
  availableFrom: string;
  availableTo: string;
  maxGuests: number;
  allowsChildren: boolean;
  allowsShabbat: boolean;
  kashrutLevel: string | null;
  notes: string | null;
  isActive: boolean;
  destination: { id: number; city: string; country?: string } | null;
}

type ActivityItem =
  | { key: string; kind: 'request'; direction: 'sent' | 'received'; item: HostingRequest }
  | { key: string; kind: 'need'; item: HostingNeed }
  | { key: string; kind: 'offer'; item: HostingOffer };

const today = () => new Date().toISOString().split('T')[0];

function Tag({ text, tone = 'gold' }: { text: string; tone?: 'gold' | 'green' | 'red' | 'neutral' }) {
  const colors = {
    gold: { bg: C.kashrutGoldBg, fg: C.kashrutGold, border: C.goldBorder },
    green: { bg: C.typeParveBg, fg: C.typeParve, border: 'rgba(107,142,107,0.24)' },
    red: { bg: '#FFF5F5', fg: C.error, border: '#FECACA' },
    neutral: { bg: C.kashrutNeutralBg, fg: C.kashrutNeutral, border: 'rgba(11,23,54,0.08)' },
  }[tone];
  return (
    <View style={[s.tag, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[s.tagText, { color: colors.fg }]}>{text}</Text>
    </View>
  );
}

function HostingActivityScreen() {
  const { destinationId, city } = useLocalSearchParams<{ destinationId?: string; city?: string }>();
  const { t, i18n } = useTranslation();
  const rtlText = i18n.language === 'he';
  const [activeSection, setActiveSection] = useState<ActivityTab | null>(null);
  const [sentRequests, setSentRequests] = useState<HostingRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<HostingRequest[]>([]);
  const [needs, setNeeds] = useState<HostingNeed[]>([]);
  const [offers, setOffers] = useState<HostingOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const scopedDestinationId = destinationId ? Number(destinationId) : undefined;
  const hasDestinationScope = Number.isFinite(scopedDestinationId);
  const scopedCity = city ? decodeURIComponent(city) : '';

  const requestStatus: Record<RequestStatus, { label: string; tone: 'gold' | 'green' | 'red' | 'neutral' }> = {
    pending: { label: t('hosting.statusPending'), tone: 'gold' },
    approved: { label: t('hosting.statusApproved'), tone: 'green' },
    rejected: { label: t('hosting.statusDeclined'), tone: 'red' },
    cancelled: { label: t('hosting.statusCancelled'), tone: 'neutral' },
  };

  const hostingTypeLabel: Record<HostingType, string> = {
    stay: t('hosting.typeStay'),
    meals: t('hosting.typeMealsOnly'),
    both: t('hosting.typeStayMeals'),
  };

  const byScope = <T extends { destination: { id: number } | null }>(rows: T[]) => (
    hasDestinationScope ? rows.filter(item => item.destination?.id === scopedDestinationId) : rows
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      const [sentRes, receivedRes, needsRes, offersRes] = await Promise.all([
        client.get('/hosting/requests/mine'),
        client.get('/hosting/requests/received'),
        client.get('/hosting/needs/mine'),
        client.get('/hosting/offers/mine'),
      ]);
      setSentRequests(byScope(Array.isArray(sentRes.data) ? sentRes.data : []));
      setReceivedRequests(byScope(Array.isArray(receivedRes.data) ? receivedRes.data : []));
      setNeeds(byScope(Array.isArray(needsRes.data) ? needsRes.data : []));
      setOffers(byScope(Array.isArray(offersRes.data) ? offersRes.data : []));
    } catch {
      Alert.alert(t('common.error'), t('hosting.failedLoadRequests'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [scopedDestinationId]);

  const itemsByTab = useMemo<Record<ActivityTab, ActivityItem[]>>(() => {
    const needsAttention: ActivityItem[] = [
      ...receivedRequests
        .filter(item => item.status === 'pending' && item.offer !== null)
        .map(item => ({ key: `received-${item.id}`, kind: 'request' as const, direction: 'received' as const, item })),
      ...sentRequests
        .filter(item => item.status === 'pending' && item.offer === null)
        .map(item => ({ key: `sent-${item.id}`, kind: 'request' as const, direction: 'sent' as const, item })),
    ];

    const matches = [...sentRequests, ...receivedRequests]
      .filter(item => item.status === 'approved')
      .map((item, index) => ({
        key: `match-${index}-${item.id}`,
        kind: 'request' as const,
        direction: sentRequests.includes(item) ? 'sent' as const : 'received' as const,
        item,
      }));

    return {
      attention: needsAttention,
      matches,
      requests: [
        ...sentRequests.map(item => ({ key: `sent-${item.id}`, kind: 'request' as const, direction: 'sent' as const, item })),
        ...needs.map(item => ({ key: `need-${item.id}`, kind: 'need' as const, item })),
      ],
      offers: offers.map(item => ({ key: `offer-${item.id}`, kind: 'offer' as const, item })),
    };
  }, [sentRequests, receivedRequests, needs, offers]);

  const tabLabel: Record<ActivityTab, string> = {
    attention: t('hosting.activityAttention'),
    matches: t('hosting.activityMatches'),
    requests: t('hosting.activityRequests'),
    offers: t('hosting.activityOffers'),
  };

  const sectionDescription: Record<ActivityTab, string> = {
    attention: t('hosting.activityAttentionDesc'),
    matches: t('hosting.activityMatchesDesc'),
    requests: t('hosting.activityRequestsDesc'),
    offers: t('hosting.activityOffersDesc'),
  };

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await client.post(`/hosting/requests/${id}/${action}`);
      loadAll();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.actionFailed'));
    }
  };

  const handleApprove = (item: HostingRequest) => {
    if (!item.overlapWarning) {
      handleAction(item.id, 'approve');
      return;
    }
    const w = item.overlapWarning;
    Alert.alert(
      t('hosting.overlapWarningTitle'),
      t('hosting.overlapWarningMsg', { name: w.guestName, from: w.arrivalDate, to: w.departureDate }),
      [
        { text: t('hosting.cancelBtn'), style: 'cancel' },
        { text: t('hosting.approveAnywayBtn'), onPress: () => handleAction(item.id, 'approve') },
      ],
    );
  };

  const handleCancel = (id: number) => {
    Alert.alert(t('hosting.cancelRequestConfirmTitle'), t('hosting.cancelRequestConfirmMsg'), [
      { text: t('hosting.backBtn'), style: 'cancel' },
      {
        text: t('hosting.cancelArrangementBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/hosting/requests/${id}/cancel`);
            loadAll();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.failedCancel'));
          }
        },
      },
    ]);
  };

  const handleDeleteRequest = (id: number) => {
    Alert.alert(t('hosting.removeFromListTitle'), t('hosting.removeFromListMsg'), [
      { text: t('hosting.backBtn'), style: 'cancel' },
      {
        text: t('hosting.removeBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/requests/${id}`);
            loadAll();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.failedRemove'));
          }
        },
      },
    ]);
  };

  const handleCloseNeed = (id: number) => {
    Alert.alert(t('hosting.closeRequestBtn'), t('hosting.closeConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.closeBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.patch(`/hosting/needs/${id}/close`);
            loadAll();
          } catch {
            Alert.alert(t('common.error'), t('hosting.failedCloseNeed'));
          }
        },
      },
    ]);
  };

  const handleDeleteNeed = (id: number) => {
    Alert.alert(t('hosting.deleteNeedConfirmTitle'), t('hosting.deleteNeedConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.deleteBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/needs/${id}`);
            loadAll();
          } catch {
            Alert.alert(t('common.error'), t('hosting.failedDeleteNeed'));
          }
        },
      },
    ]);
  };

  const handleEditOffer = (item: HostingOffer) => {
    if (!item.destination) return;
    router.push({
      pathname: '/hosting/[destinationId]',
      params: {
        destinationId: String(item.destination.id),
        city: item.destination.city,
        mode: 'host',
        editOfferId: String(item.id),
      },
    } as any);
  };

  const handleDeactivateOffer = (id: number) => {
    Alert.alert(t('hosting.deactivateConfirmTitle'), t('hosting.deactivateConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.deactivateBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/hosting/offers/${id}/deactivate`);
            loadAll();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.failedDeactivate'));
          }
        },
      },
    ]);
  };

  const handleDeleteOffer = (id: number) => {
    Alert.alert(t('hosting.deleteOfferConfirmTitle'), t('hosting.deleteOfferConfirmMsg'), [
      { text: t('hosting.cancelBtn'), style: 'cancel' },
      {
        text: t('hosting.deleteBtn'), style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/hosting/offers/${id}`);
            loadAll();
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.failedDeleteOffer'));
          }
        },
      },
    ]);
  };

  const renderMeta = (date: string, count?: string) => (
    <>
      <View style={[s.row, rtlText && s.rowRtl]}>
        <Calendar size={13} color={C.textMuted} strokeWidth={2} />
        <Text style={[s.meta, rtlText && s.rtlText]}>{date}</Text>
      </View>
      {count ? (
        <View style={[s.row, rtlText && s.rowRtl]}>
          <Users size={13} color={C.textMuted} strokeWidth={2} />
          <Text style={[s.meta, rtlText && s.rtlText]}>{count}</Text>
        </View>
      ) : null}
    </>
  );

  const renderRequest = (item: HostingRequest, direction: 'sent' | 'received') => {
    const isEnded = item.departureDate < today();
    const st = requestStatus[item.status] ?? requestStatus.pending;
    const guestName = item.guest ? `${item.guest.firstName}${item.guest.lastName ? ` ${item.guest.lastName}` : ''}` : null;
    const title = direction === 'received' && guestName ? guestName : item.destination?.city ?? '—';

    return (
      <View style={s.card}>
        <View style={[s.cardTop, rtlText && s.cardTopRtl]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardCity, rtlText && s.rtlText]}>{title}</Text>
            <Text style={[s.cardSub, rtlText && s.rtlText]}>
              {direction === 'sent' ? t('hosting.tabSent') : t('hosting.tabReceived')}
            </Text>
          </View>
          <View style={[s.pillRow, rtlText && s.pillRowRtl]}>
            {isEnded ? <Tag text={t('hosting.statusEnded')} tone="neutral" /> : null}
            <Tag text={st.label} tone={st.tone} />
          </View>
        </View>

        {renderMeta(
          `${item.arrivalDate} - ${item.departureDate}`,
          `${item.guestsCount} ${item.guestsCount !== 1 ? t('hosting.guests') : t('hosting.guest')} · ${item.hostingType === 'meals' ? t('hosting.typeMealsOnly') : t('hosting.typeStay')}${item.forShabbat ? ` · ${t('hosting.shabbatTag')}` : ''}${item.withChildren ? ` · ${t('hosting.childrenOk')}` : ''}`,
        )}

        {direction === 'received' && item.guest ? (
          <View style={s.guestBox}>
            <Text style={[s.guestName, rtlText && s.rtlText]}>{guestName}</Text>
            {item.guest.email
              ? <Text style={[s.guestEmail, rtlText && s.rtlText]}>{item.guest.email}</Text>
              : <Text style={[s.guestHidden, rtlText && s.rtlText]}>{t('hosting.contactRevealedMsg')}</Text>
            }
          </View>
        ) : null}

        {item.specialRequests ? <Text style={[s.notes, rtlText && s.rtlText]}>{item.specialRequests}</Text> : null}

        {item.status === 'approved' ? (
          <TouchableOpacity style={[s.primaryBtn, rtlText && s.actionSelfEnd]} onPress={() => router.push(`/hosting/chat/${item.id}` as any)}>
            <MessageCircle size={16} color="#fff" strokeWidth={2} />
            <Text style={s.primaryBtnText}>{t('hosting.openPrivateChatBtn')}</Text>
          </TouchableOpacity>
        ) : null}

        {direction === 'received' && item.status === 'pending' && item.offer !== null ? (
          <View style={[s.actions, rtlText && s.actionsRtl]}>
            <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(item)}>
              <Text style={s.approveBtnText}>{t('hosting.approveBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.rejectBtn} onPress={() => handleAction(item.id, 'reject')}>
              <Text style={s.rejectBtnText}>{t('hosting.declineBtn')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {direction === 'sent' && item.status === 'pending' && item.offer === null ? (
          <View style={[s.actions, rtlText && s.actionsRtl]}>
            <TouchableOpacity style={s.approveBtn} onPress={() => handleAction(item.id, 'approve')}>
              <Text style={s.approveBtnText}>{t('hosting.approveBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.rejectBtn} onPress={() => handleAction(item.id, 'reject')}>
              <Text style={s.rejectBtnText}>{t('hosting.declineBtn')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {direction === 'received' && item.status === 'pending' && item.offer === null ? (
          <Text style={[s.waitingNote, rtlText && s.rtlText]}>{t('hosting.waitingGuestDecision')}</Text>
        ) : null}

        {item.status === 'approved' ? (
          <TouchableOpacity style={[s.cancelBtn, rtlText && s.actionSelfEnd]} onPress={() => handleCancel(item.id)}>
            <Text style={s.cancelBtnText}>{t('hosting.cancelArrangementBtn')}</Text>
          </TouchableOpacity>
        ) : null}

        {item.status !== 'approved' && !(direction === 'sent' && item.status === 'pending' && item.offer === null) ? (
          <TouchableOpacity style={[s.deleteBtn, rtlText && s.actionSelfEnd]} onPress={() => handleDeleteRequest(item.id)}>
            <Text style={s.deleteBtnText}>{t('hosting.removeBtn')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderNeed = (item: HostingNeed) => {
    const isEnded = item.departureDate < today();
    return (
      <View style={s.card}>
        <View style={[s.cardTop, rtlText && s.cardTopRtl]}>
          <Text style={[s.cardCity, rtlText && s.rtlText]}>{item.destination?.city ?? '—'}</Text>
          <Tag
            text={isEnded ? t('hosting.statusEnded') : (item.isOpen ? t('hosting.statusOpen') : t('hosting.statusClosed'))}
            tone={(isEnded || !item.isOpen) ? 'neutral' : 'green'}
          />
        </View>
        {renderMeta(
          `${item.arrivalDate} - ${item.departureDate}`,
          `${item.guestsCount} ${item.guestsCount !== 1 ? t('hosting.guests') : t('hosting.guest')} · ${item.hostingType === 'meals' ? t('hosting.typeMealsOnly') : t('hosting.typeStay')}${item.forShabbat ? ` · ${t('hosting.shabbatTag')}` : ''}${item.withChildren ? ` · ${t('hosting.childrenOk')}` : ''}`,
        )}
        {item.notes ? <Text style={[s.notes, rtlText && s.rtlText]}>{item.notes}</Text> : null}
        <View style={[s.actions, rtlText && s.actionsRtl]}>
          {item.isOpen ? (
            <TouchableOpacity style={s.rejectBtn} onPress={() => handleCloseNeed(item.id)}>
              <Text style={s.rejectBtnText}>{t('hosting.closeRequestBtn')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.neutralBtn} onPress={() => handleDeleteNeed(item.id)}>
            <Text style={s.neutralBtnText}>{t('hosting.deleteBtn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOffer = (item: HostingOffer) => {
    const isEnded = item.availableTo < today();
    return (
      <View style={[s.card, !item.isActive && s.cardInactive]}>
        <View style={[s.cardTop, rtlText && s.cardTopRtl]}>
          <View style={[s.cityRow, rtlText && s.rowRtl]}>
            <Home size={16} color={C.gold} strokeWidth={2} />
            <Text style={[s.cardCity, rtlText && s.rtlText]}>{item.destination?.city ?? '—'}</Text>
          </View>
          <Tag
            text={isEnded ? t('hosting.statusEnded') : (item.isActive ? t('hosting.statusActive') : t('hosting.statusInactive'))}
            tone={isEnded || !item.isActive ? 'neutral' : 'green'}
          />
        </View>
        {renderMeta(
          `${item.availableFrom} - ${item.availableTo}`,
          `${t('hosting.upToGuests')} ${item.maxGuests} ${item.maxGuests !== 1 ? t('hosting.guests') : t('hosting.guest')}`,
        )}
        <View style={[s.inlineTags, rtlText && s.inlineTagsRtl]}>
          <Tag text={hostingTypeLabel[item.hostingType]} />
          {item.allowsShabbat ? <Tag text={t('hosting.shabbatTag')} /> : null}
          {item.allowsChildren ? <Tag text={t('hosting.childrenOk')} /> : null}
          {item.kashrutLevel ? <Tag text={item.kashrutLevel} /> : null}
        </View>
        {item.notes ? <Text style={[s.notes, rtlText && s.rtlText]}>{item.notes}</Text> : null}
        <View style={[s.actions, rtlText && s.actionsRtl]}>
          <TouchableOpacity style={s.outlineActionBtn} onPress={() => handleEditOffer(item)}>
            <Pencil size={14} color={C.navy} strokeWidth={2.5} />
            <Text style={s.outlineActionText}>{t('hosting.editBtn')}</Text>
          </TouchableOpacity>
          {item.isActive ? (
            <TouchableOpacity style={s.rejectBtn} onPress={() => handleDeactivateOffer(item.id)}>
              <X size={14} color={C.error} strokeWidth={2.5} />
              <Text style={s.rejectBtnText}>{t('hosting.deactivateBtn')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.neutralBtn} onPress={() => handleDeleteOffer(item.id)}>
            <Text style={s.neutralBtnText}>{t('hosting.deleteBtn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    if (item.kind === 'request') return renderRequest(item.item, item.direction);
    if (item.kind === 'need') return renderNeed(item.item);
    return renderOffer(item.item);
  };

  const renderSectionCard = ({ item: section }: { item: ActivityTab }) => {
    const Icon = section === 'offers' ? Home : section === 'matches' ? MessageCircle : section === 'requests' ? Users : Calendar;
    const count = itemsByTab[section].length;
    return (
      <TouchableOpacity
        style={[s.sectionCard, rtlText && s.sectionCardRtl]}
        onPress={() => setActiveSection(section)}
        activeOpacity={0.82}
      >
        <View style={[s.sectionIconBox, section === 'matches' && s.sectionIconBoxGreen]}>
          <Icon size={22} color={section === 'matches' ? C.typeParve : C.navy} strokeWidth={2.2} />
        </View>
        <View style={s.sectionTextBlock}>
          <Text style={[s.sectionTitle, rtlText && s.rtlText]}>{tabLabel[section]}</Text>
          <Text style={[s.sectionSub, rtlText && s.rtlText]}>{sectionDescription[section]}</Text>
        </View>
        <View style={s.sectionCountBox}>
          <Text style={s.sectionCount}>{count}</Text>
        </View>
        <ChevronRight
          size={18}
          color={C.textMuted}
          strokeWidth={2}
          style={rtlText ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </TouchableOpacity>
    );
  };

  const activeItems = activeSection ? itemsByTab[activeSection] : [];
  const dashboardSections = (rtlText
    ? ['offers', 'requests', 'matches', 'attention']
    : ['attention', 'matches', 'requests', 'offers']) as ActivityTab[];

  return (
    <View style={s.root}>
      <View style={[s.header, rtlText && s.headerRtl]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color={C.navy} strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, rtlText && s.rtlText]}>HOSTING</Text>
          <Text style={[s.headerTitle, rtlText && s.rtlText]}>
            {activeSection
              ? tabLabel[activeSection]
              : scopedCity ? `${t('hosting.myActivity')} · ${scopedCity}` : t('hosting.myActivity')}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : !activeSection ? (
        <FlatList
          data={dashboardSections}
          keyExtractor={(item) => item}
          contentContainerStyle={s.dashboardList}
          showsVerticalScrollIndicator={false}
          renderItem={renderSectionCard}
        />
      ) : (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListHeaderComponent={
            <Pressable style={[s.backToHub, rtlText && s.backToHubRtl]} onPress={() => setActiveSection(null)}>
              <ChevronRight
                size={17}
                color={C.navy}
                strokeWidth={2.4}
                style={!rtlText ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
              <Text style={s.backToHubText}>{t('hosting.backToActivityCenter')}</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <MessageCircle size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={[s.emptyTitle, rtlText && s.rtlText]}>{t('hosting.activityEmptyTitle')}</Text>
              <Text style={[s.emptySub, rtlText && s.rtlText]}>{t('hosting.activityEmptySub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

export default withProtectedRoute(HostingActivityScreen, 'hosting');

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  headerRtl: { flexDirection: 'row-reverse' },
  backBtn: {
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
  eyebrow: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldEyebrow, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 26, color: C.navy },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },

  dashboardList: { padding: 16, gap: 12, flexGrow: 1 },
  sectionCard: {
    minHeight: 94,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionCardRtl: { flexDirection: 'row-reverse' },
  sectionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: C.kashrutGoldBg,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconBoxGreen: {
    backgroundColor: C.typeParveBg,
    borderColor: 'rgba(107,142,107,0.24)',
  },
  sectionTextBlock: { flex: 1 },
  sectionTitle: { fontFamily: 'Inter-Bold', fontSize: 17, color: C.textPrimary },
  sectionSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, lineHeight: 19, marginTop: 3 },
  sectionCountBox: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCount: { fontFamily: 'Inter-Black', fontSize: 18, color: C.navy },
  backToHub: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.goldBorder,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  backToHubRtl: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  backToHubText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.navy },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardInactive: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  cardTopRtl: { flexDirection: 'row-reverse' },
  cardCity: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  cardSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 2 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  pillRowRtl: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rowRtl: { flexDirection: 'row-reverse' },
  meta: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary },
  inlineTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  inlineTagsRtl: { flexDirection: 'row-reverse' },
  tag: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },

  guestBox: { backgroundColor: C.surface, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: 'rgba(11,23,54,0.06)' },
  guestName: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.textPrimary },
  guestEmail: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textSecondary, marginTop: 2 },
  guestHidden: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 2 },
  notes: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 8, lineHeight: 19 },
  waitingNote: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 10 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionsRtl: { flexDirection: 'row-reverse' },
  actionSelfEnd: { alignSelf: 'flex-end' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: C.navy,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  primaryBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
  approveBtn: { flex: 1, minWidth: 130, paddingVertical: 12, borderRadius: 8, backgroundColor: C.typeParveBg, borderWidth: 1, borderColor: 'rgba(107,142,107,0.24)', alignItems: 'center' },
  rejectBtn: { flex: 1, minWidth: 130, paddingVertical: 12, borderRadius: 8, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  neutralBtn: { flex: 1, minWidth: 110, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  outlineActionBtn: { flex: 1, minWidth: 110, paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: C.goldBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  approveBtnText: { fontFamily: 'Inter-Bold', fontSize: 14, color: C.typeParve },
  rejectBtnText: { fontFamily: 'Inter-Bold', fontSize: 14, color: C.error },
  neutralBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#6B7280' },
  outlineActionText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.navy },
  cancelBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  cancelBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#DC2626' },
  deleteBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  deleteBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#6B7280' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.textSecondary },
  emptySub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
