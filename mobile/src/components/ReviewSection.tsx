import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
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
  const [data, setData] = useState<{ average: number | null; count: number; reviews: Review[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStars, setMyStars] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    client.get(`/reviews/${entityType}/${entityId}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const submit = async () => {
    if (myStars === 0) { Alert.alert('Choose a rating', 'Tap the stars to rate.'); return; }
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
      Alert.alert('Error', 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator size="small" color={C.gold} style={{ margin: 16 }} />;

  return (
    <View style={s.root}>
      {/* ── Summary ── */}
      <View style={s.summaryRow}>
        <MaterialIcons name="star" size={20} color={C.gold} />
        <Text style={s.avgText}>
          {data?.average != null ? data.average.toFixed(1) : '—'}
        </Text>
        <Text style={s.cntText}>
          {data?.count ? `(${data.count} review${data.count !== 1 ? 's' : ''})` : 'No reviews yet'}
        </Text>
        <Pressable style={s.addBtn} onPress={() => setShowForm(v => !v)}>
          <MaterialIcons name={showForm ? 'close' : 'rate-review'} size={16} color={C.navy} />
          <Text style={s.addBtnText}>{showForm ? 'Cancel' : 'Rate'}</Text>
        </Pressable>
      </View>

      {/* ── Write review form ── */}
      {showForm && (
        <View style={s.form}>
          <Text style={s.formLabel}>Your rating</Text>
          <StarRating value={myStars} onChange={setMyStars} size={28} />
          <TextInput
            style={s.input}
            placeholder="Write a comment (optional)..."
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
              : <Text style={s.submitText}>Submit Review</Text>}
          </Pressable>
        </View>
      )}

      {/* ── Review list ── */}
      {(data?.reviews ?? []).slice(0, 5).map(r => (
        <View key={r.id} style={s.reviewCard}>
          <View style={s.reviewHeader}>
            <Text style={s.reviewName}>{r.user.firstName} {r.user.lastName[0]}.</Text>
            <StarRating value={r.stars} size={14} />
          </View>
          {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
          <Text style={s.reviewDate}>
            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
