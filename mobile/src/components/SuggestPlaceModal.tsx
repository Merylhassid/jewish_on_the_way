import { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  entityType: 'restaurant' | 'synagogue';
  destinationId: number;
  destinationName: string;
}

const KASHRUT_OPTIONS = ['rabbinate', 'mehadrin', 'badatz'];
const TYPE_OPTIONS    = ['meat', 'dairy', 'pareve'];
const NUSACH_OPTIONS  = ['Ashkenaz', 'Sfarad', 'Chabad', 'Teimanim', 'Other'];

export default function SuggestPlaceModal({
  visible, onClose, entityType, destinationId, destinationName,
}: Props) {
  const isRest = entityType === 'restaurant';

  const [name,          setName]          = useState('');
  const [address,       setAddress]       = useState('');
  const [phone,         setPhone]         = useState('');
  const [websiteUrl,    setWebsiteUrl]    = useState('');
  const [notes,         setNotes]         = useState('');
  const [kashrutLevel,  setKashrutLevel]  = useState('');
  const [restaurantType,setRestaurantType]= useState('');
  const [nusach,        setNusach]        = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  const reset = () => {
    setName(''); setAddress(''); setPhone(''); setWebsiteUrl('');
    setNotes(''); setKashrutLevel(''); setRestaurantType(''); setNusach('');
  };

  const submit = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter the place name.'); return; }
    setSubmitting(true);
    try {
      await client.post('/reviews/requests', {
        entityType,
        destinationId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        kashrutLevel: kashrutLevel || undefined,
        restaurantType: restaurantType || undefined,
        nusach: nusach || undefined,
      });
      Alert.alert('Request sent!', 'Thank you. Our team will review and add this place.', [
        { text: 'OK', onPress: () => { reset(); onClose(); } },
      ]);
    } catch {
      Alert.alert('Error', 'Could not send request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>
              Suggest a {isRest ? 'Restaurant' : 'Synagogue'}
            </Text>
            <Pressable onPress={() => { reset(); onClose(); }} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.textMuted} />
            </Pressable>
          </View>
          <Text style={s.subtitle}>{destinationName}</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label="Name *" value={name} onChange={setName} placeholder={isRest ? 'Restaurant name' : 'Synagogue name'} />
            <Field label="Address" value={address} onChange={setAddress} placeholder="Street address" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 555 000 0000" keyboardType="phone-pad" />
            <Field label="Website" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://..." keyboardType="url" />

            {isRest && (
              <>
                <Text style={s.sectionLabel}>Kashrut level</Text>
                <View style={s.chipRow}>
                  {KASHRUT_OPTIONS.map(k => (
                    <Pressable
                      key={k}
                      style={[s.chip, kashrutLevel === k && s.chipActive]}
                      onPress={() => setKashrutLevel(kashrutLevel === k ? '' : k)}
                    >
                      <Text style={[s.chipText, kashrutLevel === k && s.chipTextActive]}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={s.sectionLabel}>Type</Text>
                <View style={s.chipRow}>
                  {TYPE_OPTIONS.map(t => (
                    <Pressable
                      key={t}
                      style={[s.chip, restaurantType === t && s.chipActive]}
                      onPress={() => setRestaurantType(restaurantType === t ? '' : t)}
                    >
                      <Text style={[s.chipText, restaurantType === t && s.chipTextActive]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {!isRest && (
              <>
                <Text style={s.sectionLabel}>Nusach / Denomination</Text>
                <View style={s.chipRow}>
                  {NUSACH_OPTIONS.map(n => (
                    <Pressable
                      key={n}
                      style={[s.chip, nusach === n && s.chipActive]}
                      onPress={() => setNusach(nusach === n ? '' : n)}
                    >
                      <Text style={[s.chipText, nusach === n && s.chipTextActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Field
              label="Additional notes"
              value={notes}
              onChange={setNotes}
              placeholder="Anything else we should know..."
              multiline
            />

            <Pressable
              style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.75 }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.submitText}>Submit Suggestion</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

const f = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: C.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5DCC8', borderRadius: 10,
    padding: 12, fontSize: 14, color: C.textPrimary, backgroundColor: C.card,
  },
  multiline: { minHeight: 80 },
});

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:    { fontSize: 18, fontWeight: '800', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1.5, borderColor: '#D1C4A0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card,
  },
  chipActive:     { borderColor: C.navy, backgroundColor: 'rgba(10,35,66,0.08)' },
  chipText:       { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: C.navy, fontWeight: '800' },
  submitBtn: {
    marginTop: 20, backgroundColor: C.navy, borderRadius: 14,
    padding: 15, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
