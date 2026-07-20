import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { C } from '@/constants/theme';

export default function HostingDisclaimerModal({
  visible, onAccept,
}: { visible: boolean; onAccept: () => void }) {
  const { t, i18n } = useTranslation();
  const rtlText = i18n.language === 'he';
  const tips = [
    t('hosting.safetyTipVerify'),
    t('hosting.safetyTipPublic'),
    t('hosting.safetyTipReport'),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={[s.iconBox, rtlText && s.iconBoxRtl]}>
            <ShieldCheck size={28} color={C.navy} strokeWidth={2} />
          </View>
          <Text style={[s.title, rtlText && s.rtlText]}>{t('hosting.safetyModalTitle')}</Text>
          <Text style={[s.body, rtlText && s.rtlText]}>{t('hosting.safetyModalBody')}</Text>
          <View style={s.tipsBox}>
            {tips.map((tip) => (
              <View key={tip} style={[s.tipRow, rtlText && s.tipRowRtl]}>
                <AlertTriangle size={14} color={C.goldMuted} strokeWidth={2.2} />
                <Text style={[s.tipText, rtlText && s.rtlText]}>{tip}</Text>
              </View>
            ))}
          </View>
          <Pressable style={s.btn} onPress={onAccept}>
            <Text style={s.btnText}>{t('hosting.safetyAcceptBtn')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,23,54,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380 },
  iconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.kashrutGoldBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  iconBoxRtl: { alignSelf: 'flex-end' },
  title: { fontFamily: 'Inter-Black', fontSize: 20, color: C.navy, marginBottom: 8 },
  body: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textSecondary, lineHeight: 21, marginBottom: 16 },
  tipsBox: { gap: 10, marginBottom: 20 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipRowRtl: { flexDirection: 'row-reverse' },
  tipText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  btn: { backgroundColor: C.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#fff' },
});
