import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

/** Ширина колонки: на вебе приложение — телефонная колонка по центру, чтобы судьи видели его как на телефоне */
export const FRAME_MAX = 440;

export function useFrameWidth(): number {
  return Math.min(useWindowDimensions().width, FRAME_MAX);
}

/** Высота плавающего меню и его отступ снизу */
export const TAB_BAR_HEIGHT = 68;

export function useTabBarBottom(): number {
  return Math.max(16, useSafeAreaInsets().bottom - 12);
}

/** Корневая рамка: фон темы, колонка не шире FRAME_MAX */
export function AppFrame({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={[styles.outer, { backgroundColor: t.scheme === 'dark' ? '#050506' : '#E9E1D4' }]}>
      <View style={[styles.inner, { backgroundColor: t.bg }]}>{children}</View>
    </View>
  );
}

/** Экран вкладки: прокрутка, отступ сверху под статус-бар и снизу под меню */
export function TabScreen({ children, gap = 20, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarBottom();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: bottom + TAB_BAR_HEIGHT + 36, gap }, style]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: FRAME_MAX, overflow: 'hidden' },
});
