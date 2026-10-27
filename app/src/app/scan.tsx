import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useFrameWidth } from '@/components/layout';
import { Glass, GlassButton, T } from '@/components/ui';
import { CLOSET, ME } from '@/data/demo';
import { useTheme } from '@/theme/theme';
import { PHOTO_GLASS, RECORD_RED } from '@/theme/tokens';

// Экран скана. Пока ключа Meta нет — показывает, как идёт скан: вещи «находятся» по таймеру.
// Настоящий поток: запись видео → сервер → SAM 3.1 треки → вырезки и подписи Muse Spark.

type Mode = 'rail' | 'single' | 'body';

const RAIL = ['hoodie', 'tee', 'blackjeans', 'boots'].map((id) => CLOSET.find((i) => i.id === id)!);
const SCAN_SECONDS = 30;
const BODY_SECONDS = 6;

export default function ScanScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'body' ? 'body' : 'rail');
  const [seconds, setSeconds] = useState(0);
  const body = mode === 'body';
  const total = body ? BODY_SECONDS : SCAN_SECONDS;

  useEffect(() => {
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => Math.min(s + 1, total)), 1000);
    return () => clearInterval(id);
  }, [mode, total]);

  const progress = seconds / total;
  const found = body ? Math.min(4, Math.floor((seconds / BODY_SECONDS) * 4 + 0.01)) : Math.min(RAIL.length, Math.floor(seconds / 3));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const camH = 470;

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1C' }}>
      <LinearGradient colors={['#2A2826', '#161514', '#0E0E0F']} locations={[0, 0.6, 1]} style={{ position: 'absolute', inset: 0 }} />

      {body ? (
        <View style={{ position: 'absolute', top: insets.top + 70, left: 0, right: 0, height: camH, alignItems: 'center' }}>
          <Image source={ME.front} contentFit="cover" style={{ width: (camH * 3) / 4, height: camH, opacity: 0.55 }} accessibilityLabel="Camera view: you, full height" />
        </View>
      ) : mode === 'rail' ? (
        <View style={{ position: 'absolute', top: insets.top + 100, left: 0, right: 0 }} accessibilityLabel="Camera view: closet rail">
          <View style={{ height: 4, backgroundColor: '#3A3A3E' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 8 }}>
            {RAIL.map((g, i) => {
              const on = i < found;
              return (
                <View key={g.id} style={{ width: (width - 36) / 4 - 6, alignItems: 'center' }}>
                  <Svg width={30} height={22} viewBox="0 0 30 22" fill="none" stroke="#8A8784" strokeWidth={1.6} strokeLinecap="round" style={{ marginTop: -12 }}>
                    <Path d="M15 1v6M3 20l12-13 12 13" />
                  </Svg>
                  <Image source={g.image} contentFit="contain" contentPosition="top" style={{ width: '100%', height: 184, marginTop: -2, opacity: on ? 1 : 0.55 }} accessible={false} />
                  {on ? (
                    <>
                      <View pointerEvents="none" style={{ position: 'absolute', top: 6, left: -3, right: -3, bottom: -3, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 14 }} />
                      <Glass variant="photo" style={{ position: 'absolute', top: -8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <T size={11} w={500} color={PHOTO_GLASS.text} numberOfLines={1}>
                          {label(g.name)}
                        </T>
                      </Glass>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ position: 'absolute', top: insets.top + 110, left: 0, right: 0, alignItems: 'center' }} accessibilityLabel="Camera view: one piece held up">
          <View style={{ width: 220, height: 260, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={RAIL[Math.min(found, RAIL.length - 1)].image} contentFit="contain" style={{ width: 200, height: 230 }} accessible={false} />
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 18 }} />
          </View>
        </View>
      )}

      <Svg pointerEvents="none" style={{ position: 'absolute', left: 24, top: insets.top + 76 }} width={width - 48} height={body ? camH - 10 : 290} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5}>
        <Path d={corners(width - 48, body ? camH - 10 : 290)} />
      </Svg>

      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton variant="photo" icon="close" label="Close scan" onPress={close} />
        {body ? (
          <Glass variant="photo" style={{ paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}>
            <T size={13} w={500} color={PHOTO_GLASS.text}>
              Body scan
            </T>
          </Glass>
        ) : (
          <Glass variant="photo" style={{ flexDirection: 'row', padding: 4 }}>
            {(
              [
                ['rail', 'Rail'],
                ['single', 'One by one'],
              ] as const
            ).map(([key, label]) => {
              const on = mode === key;
              return (
                <Pressable key={key} onPress={() => setMode(key)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 44, paddingHorizontal: 15, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? '#F5F5F4' : 'transparent' }}>
                  <T size={13} w={on ? 500 : 400} color={on ? '#0B0B0C' : '#E7E5E4'}>
                    {label}
                  </T>
                </Pressable>
              );
            })}
          </Glass>
        )}
        <View style={{ width: 44 }} />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: t.surface, borderTopWidth: 1, borderColor: t.line, gap: 16 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.line, alignSelf: 'center' }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }} accessibilityLiveRegion="polite">
            <T size={64} w={300} tracking={-0.04} lh={0.95}>
              {found}
            </T>
            <T size={15} color={t.muted}>
              {body ? 'of 4 angles' : found === 1 ? 'item found' : 'items found'}
            </T>
          </View>
          <T size={13} color={t.muted} style={{ marginBottom: 6, fontVariant: ['tabular-nums'] }}>
            00:{String(seconds).padStart(2, '0')}
          </T>
        </View>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: t.line, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: t.accent }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Stop recording">
            <Svg width={72} height={72}>
              <Circle cx={36} cy={36} r={34} stroke={t.line} strokeWidth={4} fill={t.surface} />
              <Circle cx={36} cy={36} r={34} stroke={t.accent} strokeWidth={4} fill="none" strokeDasharray={`${2 * Math.PI * 34}`} strokeDashoffset={2 * Math.PI * 34 * (1 - progress)} transform="rotate(-90 36 36)" />
            </Svg>
            <View style={{ position: 'absolute', top: 25, left: 25, width: 22, height: 22, borderRadius: 4, backgroundColor: RECORD_RED }} />
          </Pressable>
          <T size={14} color={t.muted} lh={1.45} style={{ flex: 1 }}>
            {body
              ? 'Prop your phone up, step back until your feet are in frame and turn slowly for six seconds.'
              : mode === 'rail'
                ? 'Move slowly along the rail. Stop at the end and the cut-outs land in your closet.'
                : 'Hold each piece up for two or three seconds. Shoes too.'}
          </T>
        </View>
        <T size={12} color={t.muted} lh={1.4}>
          Preview: the live scan runs SAM 3.1 and Muse Spark once the Meta key is connected.
        </T>
      </View>
    </View>
  );
}

/** «Black hoodie» → «Hoodie»: короткая подпись над найденной вещью */
function label(name: string): string {
  const word = name.split(' ').pop() ?? name;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Уголки видоискателя */
function corners(w: number, h: number): string {
  const c = 24;
  return `M0 ${c}V0h${c}M${w - c} 0h${c}v${c}M${w} ${h - c}v${c}h-${c}M${c} ${h}H0v-${c}`;
}
