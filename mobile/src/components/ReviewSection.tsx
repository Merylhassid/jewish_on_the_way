import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { useRequireAuth } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';
import StarRating from './StarRating';

interface Review {
  id: number;
  stars: number;
  comment: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

interface Props {
  entityType: 'restaurant' | 'synagogue';
  entityId: number;
}

export default function ReviewSection({ entityType, entityId }: Props) {
  const { t, i18n } = useTranslation();
  const requireAuth = useRequireAuth();
  const [data, setData] = useState<{ average: number | null; count: number; reviews: Review[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStars, setMyStars] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const toggleForm = () => {
    if (showForm) {
      setShowForm(false);
      return;
    }
    requireAuth(() => setShowForm(true), { reason: 'review' });
  };

  const load = useCallback(() => {
    client.get(`/reviews/${entityType}/${entityId}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityId, entityType]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (myStars === 0) { Alert.alert(t('reviews.chooseRating'), t('reviews.tapStars')); return; }
    setSubmitting(true);
    try {
      await client.post(`/reviews/${entityType}/${entityId}`, {
        stars: myStars, comment: myComment.trim() || undefined,
      });
      setShowForm(false);
      setMyStars(0);
      setMyComment('');
      load();
    } catch {
      Alert.alert(t('common.error'), t('reviews.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator size="small" color={C.gold} style={{ margin: 16 }} />;

  const reviews = data?.reviews ?? [];
  const dateLocale = i18n.resolvedLanguage === 'he'
    ? 'he-IL'
    : i18n.resolvedLanguage === 'fr' ? 'fr-FR' : 'en-GB';
  const countText = data?.count
    ? t('reviews.count', { count: data.count })
    : t('reviews.noneYet');
  const isRestaurant = entityType === 'restaurant';
  const mood = myStars >= 5 ? t('reviews.moodExcellent')
    : myStars >= 4 ? t('reviews.moodTasty')
      : myStars >= 3 ? t('reviews.moodFair')
        : myStars >= 2 ? t('reviews.moodNotGood')
          : myStars === 1 ? t('reviews.moodVeryDisappointing')
            : t('reviews.moodChoose');
  const moodIcon: React.ComponentProps<typeof MaterialIcons>['name'] =
    myStars >= 5 ? 'sentiment-very-satisfied'
      : myStars >= 4 ? 'sentiment-satisfied'
        : myStars >= 3 ? 'sentiment-neutral'
          : myStars >= 2 ? 'sentiment-dissatisfied'
            : myStars === 1 ? 'sentiment-very-dissatisfied'
              : 'sentiment-neutral';

  if (isRestaurant) {
    return (
      <View style={s.root}>
        <View style={s.summaryRow}>
          <MaterialIcons name="star" size={20} color={C.gold} />
          <Text style={s.avgText}>
            {data?.average != null ? data.average.toFixed(1) : '—'}
          </Text>
          <Text style={s.cntText}>{countText}</Text>
          <Pressable style={s.addBtn} onPress={toggleForm}>
            <MaterialIcons name={showForm ? 'close' : 'rate-review'} size={16} color={C.navy} />
            <Text style={s.addBtnText}>{showForm ? t('common.cancel') : t('reviews.rate')}</Text>
          </Pressable>
        </View>

        {showForm && (
          <View style={s.restaurantPanel}>
            <View style={s.restaurantIcon}>
              <MaterialIcons name="restaurant" size={28} color={C.navy} />
            </View>
            <Text style={s.restaurantQuestion}>{t('reviews.restaurantQuestion')}</Text>
            <StarRating value={myStars} onChange={setMyStars} size={32} />
            <View style={s.moodRow}>
              <MaterialIcons name={moodIcon} size={20} color={C.goldMuted} />
              <Text style={s.moodText}>{mood}</Text>
            </View>
            <TextInput
              style={s.restaurantInput}
              placeholder={t('reviews.commentPlaceholder')}
              placeholderTextColor={C.textMuted}
              value={myComment}
              onChangeText={setMyComment}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={s.helperText}>{t('reviews.helper')}</Text>
            <Pressable
              style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.75 }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.submitText}>{t('reviews.submitRating')}</Text>}
            </Pressable>
          </View>
        )}

        {reviews.slice(0, 5).map(r => (
          <View key={r.id} style={s.reviewCard}>
            <View style={s.reviewHeader}>
              <Text style={s.reviewName}>{r.user.firstName} {r.user.lastName[0]}.</Text>
              <StarRating value={r.stars} size={14} />
            </View>
            {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
            <Text style={s.reviewDate}>
              {new Date(r.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ── Summary ── */}
      <View style={s.summaryRow}>
        <MaterialIcons name="star" size={20} color={C.gold} />
        <Text style={s.avgText}>
          {data?.average != null ? data.average.toFixed(1) : '—'}
        </Text>
        <Text style={s.cntText}>{countText}</Text>
        <Pressable style={s.addBtn} onPress={toggleForm}>
          <MaterialIcons name={showForm ? 'close' : 'rate-review'} size={16} color={C.navy} />
          <Text style={s.addBtnText}>{showForm ? t('common.cancel') : t('reviews.rate')}</Text>
        </Pressable>
      </View>

      {/* ── Write review form ── */}
      {showForm && (
        <View style={s.form}>
          <Text style={s.formLabel}>{t('reviews.yourRating')}</Text>
          <StarRating value={myStars} onChange={setMyStars} size={28} />
          <TextInput
            style={s.input}
            placeholder={t('reviews.commentPlaceholder')}
            placeholderTextColor={C.textMuted}
            value={myComment}
            onChangeText={setMyComment}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <Pressable
            style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.75 }]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.submitText}>{t('reviews.submitReview')}</Text>}
          </Pressable>
        </View>
      )}

      {/* ── Review list ── */}
      {reviews.slice(0, 5).map(r => (
        <View key={r.id} style={s.reviewCard}>
          <View style={s.reviewHeader}>
            <Text style={s.reviewName}>{r.user.firstName} {r.user.lastName[0]}.</Text>
            <StarRating value={r.stars} size={14} />
          </View>
          {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
          <Text style={s.reviewDate}>
            {new Date(r.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 10 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avgText:  { fontSize: 16, fontWeight: '800', color: C.textPrimary },
  cntText:  { flex: 1, fontSize: 13, color: C.textMuted },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(10,35,66,0.08)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: C.navy },

  form: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  formLabel: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
  restaurantPanel: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    alignItems: 'center',
    shadowColor: C.navy,
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3EFE7',
  },
  restaurantIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.goldFaint,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  restaurantQuestion: {
    fontSize: 16,
    fontWeight: '900',
    color: C.navy,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -2,
  },
  moodText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textSecondary,
  },
  restaurantInput: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#E5DCC8',
    borderRadius: 14,
    padding: 13,
    fontSize: 14,
    color: C.textPrimary,
    minHeight: 92,
    textAlignVertical: 'top',
    backgroundColor: '#FFFEFB',
  },
  helperText: {
    marginTop: -6,
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1, borderColor: '#E5DCC8', borderRadius: 10,
    padding: 12, fontSize: 14, color: C.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: C.navy, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  reviewCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 6,
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName:   { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  reviewComment:{ fontSize: 14, color: C.textSecondary, lineHeight: 20 },
  reviewDate:   { fontSize: 11, color: C.textMuted },
});
