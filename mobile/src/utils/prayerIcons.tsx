import { Moon, Sparkles, Sun, Sunrise, Users } from 'lucide-react-native';

export type PrayerIconCfg = {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
};

export const PRAYER_ICON_CONFIG: Record<string, PrayerIconCfg> = {
  shacharit: { Icon: Sunrise,  color: '#F59E0B', bg: '#FFFBEB' },
  mincha:    { Icon: Sun,      color: '#EF4444', bg: '#FEF2F2' },
  maariv:    { Icon: Moon,     color: '#6366F1', bg: '#EEF2FF' },
  musaf:     { Icon: Sparkles, color: '#8B5CF6', bg: '#F5F3FF' },
  other:     { Icon: Users,    color: '#1a3a6b', bg: '#EFF6FF' },
};

export function getPrayerConfig(type: string): PrayerIconCfg {
  return PRAYER_ICON_CONFIG[type] ?? PRAYER_ICON_CONFIG.other;
}
