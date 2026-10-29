import { DEMO_STYLE } from '@twin/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, LogoMark } from '@/components/icons';
import { Glass, T } from '@/components/ui';
import { HERO_LOGIN } from '@/data/demo';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { PHOTO_GLASS } from '@/theme/tokens';

// Вход: пока только демо-аккаунт (честно — кнопки Apple/Google без настоящего входа не показываем). Аккаунты — Supabase Auth

export default function LoginScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = t.scheme === 'dark';
  const glass = dark ? PHOTO_GLASS : { ...t.glass, colors: ['rgba(253,251,247,0.92)', 'rgba(239,232,220,0.78)'] as [string, string] };
  const sub = dark ? '#C9C3BB' : t.muted;

  const { style, setStyle, setOnboarded } = useStore();
  // судье и всем, кто «просто посмотреть», — сразу главный шаг: замеры и стиль у демо-человека уже есть
  const explore = () => {
    if (!style) setStyle(DEMO_STYLE);
    setOnboarded(true);
    router.replace('/try');
  };
  // свои параметры и опрос — прежний путь, вход закончится в опросе
  const setUp = () => router.replace({ pathname: '/measurements', params: { first: '1' } });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 14, paddingHorizontal: 24, paddingBottom: insets.bottom + 26 }}>
      <Image source={HERO_LOGIN} contentFit="cover" contentPosition={{ top: '20%', left: '50%' }} style={{ position: 'absolute', inset: 0 }} accessible={false} />
      <LinearGradient
        pointerEvents="none"
        colors={dark ? ['rgba(11,11,12,0.6)', 'rgba(11,11,12,0)', 'rgba(11,11,12,0)', 'rgba(11,11,12,0.85)', '#0B0B0C'] : ['rgba(243,237,227,0.55)', 'rgba(243,237,227,0)', 'rgba(243,237,227,0)', 'rgba(243,237,227,0.86)', '#F3EDE3']}
        locations={[0, 0.2, 0.37, 0.57, 0.71]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Glass tokens={glass} radius={16} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <LogoMark ink={t.text} accent={t.accent} />
        </Glass>
        <T size={22} w={600} tracking={-0.03} accessibilityRole="header">
          Twin
          <T size={22} w={300} tracking={-0.03}>
            {' '}Closet
          </T>
        </T>
      </View>

      <View style={{ marginTop: 'auto', gap: 22 }}>
        <View style={{ gap: 10 }}>
          <T size={46} w={300} tracking={-0.045} lh={0.98}>
            {'Your closet,\non you.'}
          </T>
          <T size={16} color={sub} lh={1.45}>
            See any piece on your real body, styled with what you already own.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <Pressable onPress={explore} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 56, borderRadius: 999, backgroundColor: t.ctaBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: pressed ? 0.85 : 1 })}>
            <T size={16} w={500} color={t.ctaText}>
              Explore the demo account
            </T>
            <Icon name="arrow" size={18} color={t.ctaText} stroke={1.8} />
          </Pressable>
          <T size={13} color={sub} lh={1.45} style={{ textAlign: 'center' }}>
            A closet, a body scan and two pieces to try are ready. No sign-up.
          </T>
          <Pressable onPress={setUp} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <T size={14} w={500} color={t.text}>
              Set up my measurements and style
            </T>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <View style={{ marginTop: 2 }}>
              <Icon name="lock" size={15} color={sub} stroke={1.8} />
            </View>
            <T size={13} color={sub} lh={1.45} style={{ flex: 1 }}>
              Your body scan and photos stay private to you.
            </T>
          </View>
        </View>
      </View>
    </View>
  );
}
