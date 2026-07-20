import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export const SYNAGOGUE_ICON_COLOR = '#7A6B9D';
export const SYNAGOGUE_ICON_BG = '#F2F0F7';

export default function SynagogueIcon({ size = 21, color = SYNAGOGUE_ICON_COLOR }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path
        d="M10 56h44M14 56V27M50 56V27M22 56V20M42 56V20M22 20a10 10 0 0 1 20 0M18 27h10M36 27h10M28 56V42a4 4 0 0 1 8 0v14M17 56V42M47 56V42M17 42h10M37 42h10"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M32 18 43 38H21L32 18Z M32 42 21 22h22L32 42Z"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
