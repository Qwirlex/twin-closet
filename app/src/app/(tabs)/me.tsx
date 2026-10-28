import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AngleDial } from '@/components/angle-dial';
import { Icon } from '@/components/icons';
import { TabScreen, useFrameWidth } from '@/components/layout';
import { Glass, GoldRim, Label, PhotoChip, T } from '@/components/ui';
import { ANGLES, ME } from '@/data/demo';
import { countryName } from '@/data/stores';
import { isDesktopWeb } from '@/lib/platform';
import { useShopping } from '@/lib/shopping';
import { useStore } from '@/lib/store';
import { useTheme, type ThemeMode } from '@/theme/theme';
import { PHOTO_BG } from '@/theme/tokens';

const CLEAR = 'rgba(39,39,39,0)';

export default function MeScreen() {
  const { t, mode, setMode } = useTheme();
  const { setOnboarded } = useStore();
  const { favoriteIds, country } = useShopping();
  const [angle, setAngle] = useState(0);
  const heroW = useFrameWidth() - 40;
  const heroH = 372;
  const photoW = (heroH * 3) / 4;

  return (
    <TabScreen gap={16}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 6 }}>
          <T size={36} tracking={-0.03} lh={1} accessibilityRole="header">
            Me
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.accent, boxShadow: `0 0 0 3px ${t.accent}2E` }} />
            <T size={14} color={t.muted}>
              Ready for try-on · 4 angles
            </T>
          </View>
        </View>
        <Pressable onPress={() => router.push({ pathname: '/scan', params: { mode: 'body' } })} accessibilityRole="button" accessibilityLabel="Rescan body">
          <Glass style={{ minHeight: 44, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="refresh" size={18} color={t.glass.text} />
            <T size={14} w={500} color={t.glass.text}>
              Rescan
            </T>
          </Glass>
        </Pressable>
      </View>

      <View style={{ height: heroH, borderRadius: 26, backgroundColor: PHOTO_BG, overflow: 'hidden' }}>
        <Image
          source={ME[ANGLES[angle].key]}
          contentFit="cover"
          style={{ position: 'absolute', top: 0, left: (heroW - photoW) / 2, width: photoW, height: heroH }}
          accessibilityLabel={`Your body scan, ${ANGLES[angle].label} view`}
        />
        <LinearGradient pointerEvents="none" colors={[PHOTO_BG, CLEAR]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, bottom: 0, left: (heroW - photoW) / 2 - 1, width: photoW * 0.14 + 1 }} />
        <LinearGradient pointerEvents="none" colors={[CLEAR, PHOTO_BG]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, bottom: 0, right: (heroW - photoW) / 2 - 1, width: photoW * 0.14 + 1 }} />
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }} />
        <PhotoChip style={{ position: 'absolute', right: 14, top: 14 }}>{ANGLES[angle].label}</PhotoChip>
        <PhotoChip icon="lock" style={{ position: 'absolute', left: 14, bottom: 14, paddingVertical: 7 }}>
          Face and hands stay real
        </PhotoChip>
      </View>

      <AngleDial value={angle} onChange={setAngle} />

      <GoldRim style={{ paddingVertical: 13, paddingLeft: 15, paddingRight: 13, gap: 10 }}>
        <Label accent>Appearance</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 999, backgroundColor: t.surface2 }}>
          {(
            [
              ['dark', 'Dark'],
              ['light', 'Light'],
              ['system', 'System'],
            ] as [ThemeMode, string][]
          ).map(([value, label]) => {
            const on = mode === value;
            const body = (
              <T size={14} w={on ? 500 : 400} color={on ? t.text : t.muted}>
                {label}
              </T>
            );
            return (
              <Pressable key={value} onPress={() => setMode(value)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flex: 1 }}>
                {on ? (
                  <Glass style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>{body}</Glass>
                ) : (
                  <View style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>{body}</View>
                )}
              </Pressable>
            );
          })}
        </View>
      </GoldRim>

      <Pressable onPress={() => router.push('/stores')} accessibilityRole="button" accessibilityLabel={`My stores: ${favoriteIds.length}, region ${countryName(country)}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
          <Icon name="tag" size={20} color={t.accent} />
          <View style={{ flex: 1 }}>
            <T size={15} w={500}>
              My stores · {favoriteIds.length}
            </T>
            <T size={12} color={t.muted}>
              {countryName(country)} · price drops on your wishlist
            </T>
          </View>
          <Icon name="next" size={18} color={t.muted} />
        </View>
      </Pressable>

      {isDesktopWeb() ? (
        <Pressable onPress={() => router.push('/connect')} accessibilityRole="button" accessibilityLabel="Continue on your phone: scan with the phone camera, see it here">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
            <Icon name="phone" size={20} color={t.accent} />
            <View style={{ flex: 1 }}>
              <T size={15} w={500}>
                Continue on your phone
              </T>
              <T size={12} color={t.muted}>
                Film with the phone camera, see it here
              </T>
            </View>
            <Icon name="next" size={18} color={t.muted} />
          </View>
        </Pressable>
      ) : null}

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Icon name="lock" size={15} color={t.muted} stroke={1.8} />
          <T size={13} color={t.muted} lh={1.45} style={{ flex: 1 }}>
            Your body scan and photos stay private to you.
          </T>
        </View>
        <Pressable
          onPress={() => {
            setOnboarded(false);
            router.replace('/welcome');
          }}
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <T size={14} color={t.text} style={{ textDecorationLine: 'underline' }}>
            Show the intro again
          </T>
        </Pressable>
      </View>
    </TabScreen>
  );
}
