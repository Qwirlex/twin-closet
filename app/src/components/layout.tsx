import { Fragment, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { JudgePanel, useJudgePanel } from '@/components/judge-panel';
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

// Expo Router на вебе отдаёт нулевые отступы (бережёт гидрацию), и на iPhone «на экране Домой» шапки уходят под часы.
// Сайт у нас одной страницей без гидрации — меряем env(safe-area-inset-*) сами. В приложении отступы уже настоящие
const WebSafeArea = Platform.OS === 'web' ? SafeAreaProvider : Fragment;

/** Корневая рамка: фон темы, колонка не шире FRAME_MAX; на сайте с компьютера слева — панель судьи */
export function AppFrame({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  const judge = useJudgePanel();
  const outerBg = t.scheme === 'dark' ? '#050506' : '#E9E1D4';
  if (judge)
    return (
      <View style={[styles.outer, styles.withPanel, { backgroundColor: outerBg }]}>
        <JudgePanel />
        <View style={[styles.inner, styles.framed, { backgroundColor: t.bg, borderColor: t.line }]}>
          <WebSafeArea>{children}</WebSafeArea>
        </View>
      </View>
    );
  return (
    <View style={[styles.outer, { backgroundColor: outerBg }]}>
      <View style={[styles.inner, { backgroundColor: t.bg }]}>
        <WebSafeArea>{children}</WebSafeArea>
      </View>
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
  // панель + колонка по центру окна; колонка как телефон — со скруглением и кантом
  withPanel: { flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 32, paddingVertical: 24, paddingHorizontal: 24 },
  // flex: 0 на вебе — нулевая основа и колонка в 2 px; ширину задаёт основа
  framed: { flexGrow: 0, flexShrink: 0, flexBasis: FRAME_MAX, width: FRAME_MAX, borderRadius: 28, borderWidth: 1 },
});
