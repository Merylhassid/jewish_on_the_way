import { Pressable, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props extends PressableProps {
  haptic?: 'light' | 'medium' | 'heavy' | 'selection';
}

export default function HapticPressable({ onPress, haptic = 'light', ...rest }: Props) {
  const handlePress = async (e: any) => {
    try {
      if (haptic === 'selection') {
        await Haptics.selectionAsync();
      } else {
        await Haptics.impactAsync(
          haptic === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy
          : haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
        );
      }
    } catch {}
    onPress?.(e);
  };

  return <Pressable {...rest} onPress={handlePress} />;
}
