import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, Label, PhotoChip, T, Cta } from '@/components/ui';
import { CLOSET, LOOKS, ME, SHOP } from '@/data/demo';
import { useTheme } from '@/theme/theme';
import { PHOTO_GLASS } from '@/theme/tokens';

const COPY = [
  { title: 'Scan yourself once', body: 'Prop your phone up and turn around slowly for six seconds. Every try-on uses your real body and face.' },
  { title: 'Film your closet', body: 'Walk along your rail for 30 seconds. Every piece is found, cut out and tagged for you.' },
  { title: 'Try on anything', body: 'Screenshot a piece from any store, or snap it in the shop. See it on you with clothes you already own.' },
];

const GRID = [...CLOSET, ...SHOP].slice(0, 6);

export default function WelcomeScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const last = step === COPY.length - 1;
  // на низких экранах (iPhone SE) картинка ниже, чтобы текст и кнопки влезли без прокрутки
  const heroH = Math.min(486, Math.round(useWindowDimensions().height * 0.56)) + insets.top - 20;
  // фото начинается под строкой статуса: иначе голова уходит под вырез, а выше — цвет верхнего края снимка, без шва
  const photo = { position: 'absolute', top: insets.top, left: 0, right: 0, bottom: 0 } as const;
  const photoTop = '#222222';
  const seam = insets.top ? (
    <LinearGradient pointerEvents="none" colors={[photoTop, 'transparent']} style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 24 }} />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, gap: 26 }}>
      <View style={{ height: heroH, backgroundColor: step === 1 ? t.render : photoTop, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' }}>
        {step === 0 ? (
          <>
            <Image source={ME.front} contentFit="cover" contentPosition={{ top: '15%', left: '50%' }} style={photo} accessibilityLabel="You, front view from the body scan" />
            <View style={{ position: 'absolute', right: 14, bottom: 16, gap: 8 }}>
              {(
                [
                  [ME.three_quarter, '3/4'],
                  [ME.side, 'Side'],
                  [ME.back, 'Back'],
                ] as const
              ).map(([src, label]) => (
                <View key={label} style={{ width: 58, height: 76, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
                  <Image source={src} contentFit="cover" contentPosition={{ top: '25%', left: '50%' }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`${label} view`} />
                  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center' }}>
                    <T size={10} w={500} color="#F5F5F4">
                      {label}
                    </T>
                  </View>
                </View>
              ))}
            </View>
            {seam}
            <PhotoChip style={{ position: 'absolute', left: 16, bottom: 18 }}>6-second spin · 4 angles</PhotoChip>
          </>
        ) : null}

        {step === 1 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
            <View style={{ width: 98 * 3 + 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {GRID.map((g) => (
                <View key={g.id} style={{ width: 98, height: 112, borderRadius: 18, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={g.image} contentFit="contain" style={{ width: '84%', height: '84%' }} accessibilityLabel={g.name} />
                </View>
              ))}
            </View>
            <Glass radius={999} style={{ position: 'absolute', top: insets.top + 20, paddingHorizontal: 14, paddingVertical: 7 }}>
              <T size={12} color={t.glass.text}>
                Cut out and tagged for you
              </T>
            </Glass>
          </View>
        ) : null}

        {step === 2 ? (
          <>
            <Image source={ME.front} contentFit="cover" contentPosition={{ top: '15%', left: '50%' }} style={photo} accessible={false} />
            <View style={{ position: 'absolute', top: insets.top, bottom: 0, left: '50%', right: 0, overflow: 'hidden' }}>
              <Image source={LOOKS[0].renders.front} contentFit="cover" contentPosition={{ top: '15%', left: '50%' }} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '200%' }} accessibilityLabel="You wearing the new outfit" />
            </View>
            <View style={{ position: 'absolute', top: insets.top, bottom: 0, left: '50%', width: 1.5, marginLeft: -0.75, backgroundColor: 'rgba(255,255,255,0.8)' }} />
            {seam}
            <Glass variant="photo" radius={16} style={{ position: 'absolute', left: 22, top: insets.top + 92, width: 92, paddingTop: 10, paddingBottom: 8, alignItems: 'center', gap: 4, transform: [{ rotate: '-6deg' }] }}>
              <Image source={SHOP[0].image} contentFit="contain" style={{ width: 70, height: 70 }} accessibilityLabel="Screenshot of wide-leg jeans" />
              <T size={10} w={500} color={PHOTO_GLASS.text}>
                Screenshot
              </T>
            </Glass>
            <PhotoChip style={{ position: 'absolute', left: 16, bottom: 18 }}>Your face stays yours</PhotoChip>
          </>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 24, gap: 12 }}>
        <Label accent>
          Step {step + 1} of {COPY.length}
        </Label>
        <T size={34} tracking={-0.03} lh={1.05} accessibilityRole="header">
          {COPY[step].title}
        </T>
        <T size={16} color={t.muted} lh={1.5}>
          {COPY[step].body}
        </T>
      </View>

      <View style={{ marginTop: 'auto', paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 18 }}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessible={false}>
          {COPY.map((_, i) => (
            <View key={i} style={{ height: 6, borderRadius: 3, width: i === step ? 22 : 6, backgroundColor: i === step ? t.accent : t.line }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.replace('/login')} accessibilityRole="button" style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
            <T size={15} color={t.muted}>
              Skip
            </T>
          </Pressable>
          <Cta grow={false} title={last ? 'Get started' : 'Continue'} style={{ paddingLeft: 24 }} onPress={() => (last ? router.replace('/login') : setStep(step + 1))} />
        </View>
      </View>
    </View>
  );
}
