import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { C } from '@/constants/theme';

interface Props {
  message?: string;
  onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.iconWrap}>
        <WifiOff size={32} color="#BBC3D4" strokeWidth={1.5} />
      </View>
      <Text style={s.title}>משהו השתבש</Text>
      <Text style={s.sub}>{message ?? 'בדוק את החיבור לאינטרנט ונסה שוב'}</Text>
      <Pressable style={s.btn} onPress={onRetry}>
        <Text style={s.btnText}>נסה שוב</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontFamily: 'Inter-ExtraBold', fontSize: 18, color: C.textPrimary, letterSpacing: -0.3 },
  sub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8, backgroundColor: C.navy,
    borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
  },
  btnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
});
