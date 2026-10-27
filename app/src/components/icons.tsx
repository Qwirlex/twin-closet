import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** На вебе <svg> без position рисуется под абсолютными слоями стекла — оборачиваем во View (там position: relative) */
function Box({ children }: { children: ReactNode }) {
  return <View pointerEvents="none">{children}</View>;
}

// Контурные иконки 1.6px (docs/design.md, «Иконки»), пути из макетов
export const ICONS = {
  closet: 'M10 6a2 2 0 1 1 2 2c-.6 0-1 .4-1 1v1l9 6.5a1 1 0 0 1-.6 1.8H4.6a1 1 0 0 1-.6-1.8L13 10',
  looks: 'M7 7h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z M8 4h8',
  tryOn: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  me: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M4 21c1-4 4-6 8-6s7 2 8 6',
  search: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z M20 20l-3.5-3.5',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  compare: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  plus: 'M12 5v14M5 12h14',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3',
  stop: 'M8 8h8v8H8z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  mail: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 7l9 6 9-6',
  send: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  film: 'M4 5h16v14H4z M8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  video: 'M4 7h11v10H4z M15 10.5l5-3v9l-5-3',
} as const;

export type IconName = keyof typeof ICONS | 'lock' | 'dots';

export function Icon({ name, size = 22, color, stroke = 1.6, filled = false }: { name: IconName; size?: number; color: string; stroke?: number; filled?: boolean }) {
  if (name === 'lock') {
    return (
      <Box>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <Rect x={5} y={11} width={14} height={10} rx={2} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </Svg>
      </Box>
    );
  }
  if (name === 'dots') {
    return (
      <Box>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Circle cx={5} cy={12} r={1.6} />
          <Circle cx={12} cy={12} r={1.6} />
          <Circle cx={19} cy={12} r={1.6} />
        </Svg>
      </Box>
    );
  }
  return (
    <Box>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        <Path d={ICONS[name]} />
      </Svg>
    </Box>
  );
}

export function AppleIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Box>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2.1-.5 2.7-1.3z" />
      </Svg>
    </Box>
  );
}

export function GoogleIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Box>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
        <Path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5z" />
        <Path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z" />
        <Path d="M7 13.8a5.4 5.4 0 0 1 0-3.6V7.9H4a9 9 0 0 0 0 8.2z" />
        <Path d="M12 6.5c1.3 0 2.5.5 3.4 1.3L18 5.3A9 9 0 0 0 4 7.9l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
      </Svg>
    </Box>
  );
}

/** Знак — разделённая вешалка: «ты» и «твой двойник» */
export function LogoMark({ size = 34, ink, accent }: { size?: number; ink: string; accent: string }) {
  return (
    <Box>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" accessibilityLabel="Twin Closet logo">
        <Path d="M27.5 15a4.5 4.5 0 1 1 4.5 4.5V25" stroke={ink} />
        <Path d="M32 25L9.5 44.2c-1.4 1.2-.6 3.3 1.2 3.3H32" stroke={ink} />
        <Path d="M32 25l22.5 19.2c1.4 1.2.6 3.3-1.2 3.3H32" stroke={accent} />
      </Svg>
    </Box>
  );
}
