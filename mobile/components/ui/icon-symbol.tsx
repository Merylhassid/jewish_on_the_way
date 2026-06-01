import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING: IconMapping = {
  // ── Tab bar ────────────────────────────────────────────────────────────────
  'map.fill':                         'map',
  'safari.fill':                      'explore',
  'person.crop.circle.fill':          'account-circle',

  // ── Navigation ────────────────────────────────────────────────────────────
  'chevron.left':                     'chevron-left',
  'chevron.right':                    'chevron-right',
  'arrow.left':                       'arrow-back',
  'arrow.right':                      'arrow-forward',
  'xmark':                            'close',

  // ── Services ──────────────────────────────────────────────────────────────
  'fork.knife':                       'restaurant',
  'building.columns.fill':            'account-balance',
  'person.3.fill':                    'groups',
  'house.fill':                       'home',
  'bubble.left.fill':                 'chat',
  'location.north.fill':              'navigation',

  // ── UI ────────────────────────────────────────────────────────────────────
  'magnifyingglass':                  'search',
  'bell.fill':                        'notifications',
  'star.fill':                        'star',
  'heart.fill':                       'favorite',
  'gearshape.fill':                   'settings',
  'globe':                            'language',
  'person.fill':                      'person',
  'camera.fill':                      'camera-alt',
  'photo.fill':                       'photo',
  'lock.fill':                        'lock',
  'envelope.fill':                    'email',
  'phone.fill':                       'phone',
  'clock.fill':                       'access-time',
  'location.fill':                    'place',
  'info.circle.fill':                 'info',
  'checkmark.circle.fill':            'check-circle',
  'exclamationmark.circle.fill':      'error',
  'trash.fill':                       'delete',
  'pencil':                           'edit',

  // ── Legacy (keep for backward compat) ─────────────────────────────────────
  'house':                            'home',
  'paperplane.fill':                  'send',
  'chevron.left.forwardslash.chevron.right': 'code',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name] ?? 'help-outline';
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
