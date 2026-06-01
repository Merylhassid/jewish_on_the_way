import { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

const RESTAURANT_TYPES = [
  { key: 'not_kosher',  label: 'No longer kosher', icon: 'no-meals' as const },
  { key: 'wrong_info',  label: 'Wrong kashrut info', icon: 'error-outline' as const },
  { key: 'closed',      label: 'Permanently closed', icon: 'store' as const },
  { key: 'wrong_hours', label: 'Wrong opening hours', icon: 'schedule' as const },
  { key: 'other',       label: 'Other issue', icon: 'flag' as const },
];
const SYNAGOGUE_TYPES = [
  { key: 'closed',      label: 'Synagogue closed', icon: 'store' as const },
  { key: 'moved',       label: 'Moved to new address', icon: 'place' as const },
  { key: 'wrong_info',  label: 'Wrong information', icon: 'error-outline' as const },
  { key: 'wrong_hours', label: 'Wrong prayer times', icon: 'schedule' as const },
  { key: 'other',       label: 'Other issue', icon: 'flag' as const },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  entityType: 'restaurant' | 'synagogue';
  entityId: number;
  entityName: string;
}

export default function ReportModal({ visible, onClose, entityType, entityId, entityName }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const types = entityType === 'restaurant' ? RESTAURANT_TYPES : SYNAGOGUE_TYPES;

  const reset = () => { setSelected(null); setDescription(''); };

  const submit = async () => {
    if (!selected) { Alert.alert('Select a reason'); return; }
    setSubmitting(true);
    try {
      await client.post(`/reviews/${entityType}/${entityId}/report`, {
        reportType: selected,
        description: description.trim() || undefined,
      });
      Alert.alert('Report sent', 'Thank you. Our team will review this.', [
        { text: 'OK', onPress: () => { reset(); onClose(); } },
      ]);
    } catch {
      Alert.alert('Error', 'Could not send report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Report an issue</Text>
            <Pressable onPress={() => { reset(); onClose(); }} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.textMuted} />
            </Pressable>
          </View>

          <Text style={s.subtitle} numberOfLines={1}>
            {entityName}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>What&apos;s the problem?</Text>
            {types.map(t => (
              <Pressable
                key={t.key}
                style={[s.option, selected === t.key && s.optionSelected]}
                onPress={() => setSelected(t.key)}
              >
                <MaterialIcons
                  name={t.icon}
                  size={20}
                  color={selected === t.key ? C.navy : C.textMuted}
                />
                <Text style={[s.optionText, selected === t.key && s.optionTextSelected]}>
                  {t.label}
                </Text>
                {selected === t.key && (
                  <MaterialIcons name="check-circle" size={18} color={C.navy} />
                )}
              </Pressable>
            ))}

            <Text style={[s.sectionLabel, { marginTop: 16 }]}>
              Additional details (optional)
            </Text>
            <TextInput
              style={s.input}
              placeholder="Describe the issue..."
              placeholderTextColor={C.textMuted}
              value={description}
              onChangeText={setDescription}
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
                : <Text style={s.submitText}>Send Report</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '85%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:    { fontSize: 18, fontWeight: '800', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginBottom: 20 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 8 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optionSelected: { borderColor: C.navy, backgroundColor: 'rgba(10,35,66,0.06)' },
  optionText: { flex: 1, fontSize: 15, color: C.textSecondary },
  optionTextSelected: { color: C.navy, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: '#E5DCC8', borderRadius: 10,
    padding: 12, fontSize: 14, color: C.textPrimary,
    minHeight: 80, textAlignVertical: 'top', backgroundColor: C.card,
  },
  submitBtn: {
    marginTop: 20, backgroundColor: '#DC2626', borderRadius: 14,
    padding: 15, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
