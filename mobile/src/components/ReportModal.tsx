import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import SwipeableSheet from './SwipeableSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  entityType: 'restaurant' | 'synagogue';
  entityId: number;
  entityName: string;
}

export default function ReportModal({ visible, onClose, entityType, entityId, entityName }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const RESTAURANT_TYPES = [
    { key: 'not_kosher',  label: t('report.notKosher'),       icon: 'no-meals' as const },
    { key: 'wrong_info',  label: t('report.wrongKashrut'),    icon: 'error-outline' as const },
    { key: 'closed',      label: t('report.closed'),          icon: 'store' as const },
    { key: 'wrong_hours', label: t('report.wrongHours'),      icon: 'schedule' as const },
    { key: 'other',       label: t('report.other'),           icon: 'flag' as const },
  ];
  const SYNAGOGUE_TYPES = [
    { key: 'closed',      label: t('report.synClosed'),       icon: 'store' as const },
    { key: 'moved',       label: t('report.synMoved'),        icon: 'place' as const },
    { key: 'wrong_info',  label: t('report.wrongInfo'),       icon: 'error-outline' as const },
    { key: 'wrong_hours', label: t('report.wrongPrayerTimes'),icon: 'schedule' as const },
    { key: 'other',       label: t('report.other'),           icon: 'flag' as const },
  ];

  const types = entityType === 'restaurant' ? RESTAURANT_TYPES : SYNAGOGUE_TYPES;

  const reset = () => { setSelected(null); setDescription(''); };

  const submit = async () => {
    if (!selected) { Alert.alert(t('report.selectReason')); return; }
    setSubmitting(true);
    try {
      await client.post(`/reviews/${entityType}/${entityId}/report`, {
        reportType: selected,
        description: description.trim() || undefined,
      });
      Alert.alert(t('report.sent'), t('report.sentMsg'), [
        { text: t('common.save'), onPress: () => { reset(); onClose(); } },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('report.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <SwipeableSheet visible={visible} onClose={handleClose} maxHeight="85%">
      <View style={s.inner}>
        <View style={s.header}>
          <Text style={s.title}>{t('report.title')}</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <MaterialIcons name="close" size={22} color={C.textMuted} />
          </Pressable>
        </View>

        <Text style={s.subtitle} numberOfLines={1}>{entityName}</Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionLabel}>{t('report.whatsWrong')}</Text>
          {types.map(tp => (
            <Pressable
              key={tp.key}
              style={[s.option, selected === tp.key && s.optionSelected]}
              onPress={() => setSelected(tp.key)}
            >
              <MaterialIcons name={tp.icon} size={20} color={selected === tp.key ? C.navy : C.textMuted} />
              <Text style={[s.optionText, selected === tp.key && s.optionTextSelected]}>{tp.label}</Text>
              {selected === tp.key && <MaterialIcons name="check-circle" size={18} color={C.navy} />}
            </Pressable>
          ))}

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>{t('report.details')}</Text>
          <TextInput
            style={s.input}
            placeholder={t('report.detailsPlaceholder')}
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
              : <Text style={s.submitText}>{t('report.send')}</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </SwipeableSheet>
  );
}

const s = StyleSheet.create({
  inner: { paddingHorizontal: 20, paddingBottom: 0 },
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
