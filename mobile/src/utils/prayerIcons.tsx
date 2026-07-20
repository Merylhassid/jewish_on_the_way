import { Moon, Sparkles, Sun, Sunrise, Users } from 'lucide-react-native';

export type PrayerIconCfg = {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
};

export const PRAYER_ICON_CONFIG: Record<string, PrayerIconCfg> = {
  shacharit: { Icon: Sunrise,  color: '#C48A2C', bg: '#FBF6E9' },
  mincha:    { Icon: Sun,      color: '#B4544A', bg: '#F7EEEC' },
  maariv:    { Icon: Moon,     color: '#5B7C99', bg: '#EEF2F6' },
  musaf:     { Icon: Sparkles, color: '#7A6B9D', bg: '#F2F0F7' },
  other:     { Icon: Users,    color: '#0B1736', bg: '#F4F4F5' },
};

export function getPrayerConfig(type: string): PrayerIconCfg {
  return PRAYER_ICON_CONFIG[type] ?? PRAYER_ICON_CONFIG.other;
}
