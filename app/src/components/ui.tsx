import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/icons';
import { useTheme } from '@/theme/theme';
import { FONT, PHOTO_GLASS, type Glass as GlassTokens, type Weight } from '@/theme/tokens';

type TProps = TextProps & {
  size?: number;
  w?: Weight;
  color?: string;
  /** межбуквенный интервал в em, как в макетах */
  tracking?: number;
  upper?: boolean;
  lh?: number;
};

/** Текст Inter Tight: размер, вес, цвет и интервал в em */
export function T({ size = 15, w = 400, color, tracking, upper, lh, style, ...rest }: TProps) {
  const { t } = useTheme();
  const spacing = tracking ?? (upper ? 0.14 : 0);
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: FONT[w],
          fontSize: size,
          color: color ?? t.text,
          letterSpacing: spacing * size,
          textTransform: upper ? 'uppercase' : 'none',
          lineHeight: lh ? lh * size : undefined,
        },
        style,
      ]}
    />
  );
}

/** Метка 11–12px капсом: muted или accent */
export function Label({ children, accent, style }: { children: ReactNode; accent?: boolean; style?: StyleProp<TextStyle> }) {
  const { t } = useTheme();
  return (
    <T size={11} w={600} upper color={accent ? t.accent : t.muted} style={style}>
      {children}
    </T>
  );
}

/** Жидкое стекло: градиент сверху светлее, кант 1px, блик сверху. variant photo — тёмное стекло с размытием поверх фото */
export function Glass({ children, style, radius = 999, variant = 'ui', tokens }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; variant?: 'ui' | 'photo'; tokens?: GlassTokens }) {
  const { t } = useTheme();
  const g = tokens ?? (variant === 'photo' ? PHOTO_GLASS : t.glass);
  return (
    // zIndex 0 + слои на -1: на вебе стекло лежит под содержимым и не перехватывает нажатия (поля ввода, иконки)
    <View style={[{ borderRadius: radius, borderWidth: 1, borderColor: g.border, boxShadow: g.shadow, overflow: 'hidden', zIndex: 0 }, style]}>
      {/* скругление у слоёв — на случай overflow: visible (меню с приподнятой кнопкой) */}
      {g.blur > 0 ? <BlurView pointerEvents="none" intensity={g.blur} tint={t.scheme === 'dark' || variant === 'photo' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', zIndex: -1 }]} /> : null}
      <LinearGradient pointerEvents="none" colors={g.colors} style={[StyleSheet.absoluteFill, { borderRadius: radius, zIndex: -1 }]} />
      {children}
    </View>
  );
}

type GlassButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  label: string;
  size?: number;
  iconSize?: number;
  variant?: 'ui' | 'photo';
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Круглая стеклянная кнопка-иконка 44px */
export function GlassButton({ icon, label, size = 44, iconSize = 20, variant = 'ui', filled, style, ...rest }: GlassButtonProps) {
  const { t } = useTheme();
  const color = variant === 'photo' ? PHOTO_GLASS.text : t.glass.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} {...rest} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }, style]}>
      <Glass variant={variant} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={iconSize} color={color} filled={filled} />
      </Glass>
    </Pressable>
  );
}

/** Солнце/луна: быстрый переключатель темы в шапке */
export function ThemeToggle() {
  const { t, toggle } = useTheme();
  const dark = t.scheme === 'dark';
  return <GlassButton icon={dark ? 'sun' : 'moon'} label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onPress={toggle} />;
}

/** Золотой кант у ключевых карточек */
export function GoldRim({ children, radius = 22, style }: { children: ReactNode; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <LinearGradient colors={t.rim} locations={[0, 0.6]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius, padding: 1 }}>
      <View style={[{ borderRadius: radius - 1, backgroundColor: t.surface }, style]}>{children}</View>
    </LinearGradient>
  );
}

/** Круг accent со стрелкой — правая часть главной кнопки */
export function ArrowDot({ size = 48 }: { size?: number }) {
  const { t } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="arrow" size={20} color={t.onAccent} stroke={1.8} />
    </View>
  );
}

type CtaProps = Omit<PressableProps, 'children' | 'style'> & { title: string; sub?: string; style?: StyleProp<ViewStyle>; grow?: boolean };

/** Главная кнопка — пилюля 64px: заголовок + подстрочник слева, круг со стрелкой справа */
export function Cta({ title, sub, style, grow = true, disabled, ...rest }: CtaProps) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        {
          minHeight: 64,
          borderRadius: 999,
          backgroundColor: t.ctaBg,
          paddingLeft: 22,
          paddingRight: 8,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: grow ? 'space-between' : 'flex-start',
          gap: 18,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      <View style={{ gap: 1, flexShrink: 1 }}>
        <T size={15} w={500} color={t.ctaText}>
          {title}
        </T>
        {sub ? (
          <T size={12} color={t.ctaSub}>
            {sub}
          </T>
        ) : null}
      </View>
      <ArrowDot />
    </Pressable>
  );
}

/** Сфера Twin: белый → шампань → бронза, свечение accent */
export function Orb({ size = 34 }: { size?: number }) {
  const { t } = useTheme();
  const stops = t.orb;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, boxShadow: `0 0 ${Math.round(size / 2)}px ${t.orbGlow}` }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orb" cx="35%" cy="30%" r="75%" fx="35%" fy="30%">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="0.42" stopColor={stops[1]} />
            <Stop offset="0.78" stopColor={stops[2]} />
            <Stop offset="1" stopColor={stops[3]} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#orb)" />
      </Svg>
    </View>
  );
}

/** Метка NEW (accent) или YOURS (обводка) */
export function Tag({ kind, text }: { kind: 'new' | 'yours'; text?: string }) {
  const { t } = useTheme();
  const isNew = kind === 'new';
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: isNew ? t.accent : 'transparent',
        borderWidth: isNew ? 0 : 1,
        borderColor: t.line,
        alignSelf: 'flex-start',
      }}>
      <T size={10} w={600} tracking={0.1} upper color={isNew ? t.onAccent : t.muted}>
        {text ?? (isNew ? 'New' : 'Yours')}
      </T>
    </View>
  );
}

/** Подпись-пилюля на фото: тёмное стекло в обеих темах */
export function PhotoChip({ children, icon, style }: { children: ReactNode; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Glass variant="photo" style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 }, style]}>
      {icon ? <Icon name={icon} size={14} color={PHOTO_GLASS.text} stroke={1.8} /> : null}
      <T size={12} w={500} color={PHOTO_GLASS.text}>
        {children}
      </T>
    </Glass>
  );
}
