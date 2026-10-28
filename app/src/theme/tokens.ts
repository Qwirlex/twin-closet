// Токены дизайн-системы Noir (docs/design.md): компоненты берут цвета только отсюда
export type Scheme = 'dark' | 'light';

export interface Palette {
  scheme: Scheme;
  bg: string;
  surface: string;
  surface2: string;
  /** фон под вырезками вещей */
  render: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  /** тёплая глина: «не сядет», ошибка в поле — вместо красного */
  warn: string;
  onAccent: string;
  ctaBg: string;
  ctaText: string;
  ctaSub: string;
  /** начало и конец золотого канта */
  rim: [string, string];
  /** жидкое стекло на фоне экрана */
  glass: Glass;
  /** нижнее меню */
  bar: Glass;
  orb: string[];
  orbGlow: string;
  fabShadow: string;
}

export interface Glass {
  colors: [string, string];
  border: string;
  shadow: string;
  text: string;
  blur: number;
}

/** Фон под фото людей: совпадает с краем студийных снимков, шва нет */
export const PHOTO_BG = '#272727';

/** Стекло поверх фото — всегда тёмное, в обеих темах */
export const PHOTO_GLASS: Glass = {
  colors: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)'],
  border: 'rgba(255,255,255,0.18)',
  shadow: 'inset 0 1px 0 rgba(255,255,255,0.32), 0 8px 24px rgba(0,0,0,0.35)',
  text: '#F5F5F4',
  blur: 30,
};

export const RECORD_RED = '#E5484D';

/** Метки посадки поверх фото — фото всегда тёмное: золото «как задумано», глина «не сядет», светлый «к сведению» */
export const FIT_ON_PHOTO = { good: '#C8B68A', problem: '#D9906E', note: '#E7E5E4' } as const;

export const PALETTES: Record<Scheme, Palette> = {
  dark: {
    scheme: 'dark',
    bg: '#0B0B0C',
    surface: '#141416',
    surface2: '#1C1C1F',
    render: '#1A1A1C',
    line: '#2A2A2D',
    text: '#F5F5F4',
    muted: '#A8A29E',
    accent: '#C8B68A',
    warn: '#D9906E',
    onAccent: '#0B0B0C',
    ctaBg: '#F5F5F4',
    ctaText: '#0B0B0C',
    ctaSub: '#5E554A',
    rim: ['#C8B68A', '#2A2A2D'],
    glass: {
      colors: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'],
      border: 'rgba(255,255,255,0.12)',
      shadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 18px rgba(0,0,0,0.35)',
      text: '#F5F5F4',
      blur: 0,
    },
    bar: {
      colors: ['rgba(34,34,37,0.84)', 'rgba(18,18,20,0.84)'],
      border: 'rgba(255,255,255,0.10)',
      shadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 30px rgba(0,0,0,0.45)',
      text: '#F5F5F4',
      blur: 40,
    },
    orb: ['#FFFFFF', '#E4D6AE', '#8C7A4E', '#3A3328'],
    orbGlow: 'rgba(200,182,138,0.4)',
    fabShadow: '0 12px 28px rgba(0,0,0,0.55)',
  },
  light: {
    scheme: 'light',
    bg: '#F3EDE3',
    surface: '#FBF8F2',
    surface2: '#E9E1D4',
    render: '#E6DDCF',
    line: '#DDD3C4',
    text: '#1B1712',
    muted: '#5E554A',
    accent: '#7A6638',
    warn: '#9A4B2B',
    onAccent: '#FFFFFF',
    ctaBg: '#1B1712',
    ctaText: '#F3EDE3',
    ctaSub: '#CFC6B8',
    rim: ['#A88F57', '#DDD3C4'],
    glass: {
      colors: ['#FDFBF7', '#EFE8DC'],
      border: 'rgba(27,23,18,0.08)',
      shadow: 'inset 0 1px 0 #FFFFFF, 0 4px 14px rgba(27,23,18,0.08)',
      text: '#1B1712',
      blur: 0,
    },
    bar: {
      colors: ['rgba(255,255,255,0.94)', 'rgba(243,237,227,0.88)'],
      border: 'rgba(27,23,18,0.08)',
      shadow: 'inset 0 1px 0 #FFFFFF, 0 10px 26px rgba(27,23,18,0.10)',
      text: '#1B1712',
      blur: 40,
    },
    orb: ['#FFFFFF', '#D9CBA4', '#8C7A4E', '#8C7A4E'],
    orbGlow: 'rgba(122,102,56,0.3)',
    fabShadow: '0 12px 26px rgba(27,23,18,0.22)',
  },
};

/** Inter Tight по весам: у своих шрифтов fontWeight в RN не работает, нужен отдельный fontFamily */
export const FONT = {
  300: 'InterTight_300Light',
  400: 'InterTight_400Regular',
  500: 'InterTight_500Medium',
  600: 'InterTight_600SemiBold',
} as const;

export type Weight = keyof typeof FONT;
