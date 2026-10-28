import { FAMILY_NAME, profileFromVotes, STYLE_FAMILIES, STYLES, stylesIn, type StyleFamily, type StyleGuide, type StyleId, type StyleProfile, type StyleVote } from '@twin/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { useFrameWidth } from '@/components/layout';
import { Cta, GlassButton, Label, T } from '@/components/ui';
import { stylePic, type Wear } from '@/data/styles';
import { readSetting, writeSetting } from '@/lib/storage';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { PHOTO_BG } from '@/theme/tokens';

// Опрос стиля (PLAN.md §1.2 Е): после параметров (first=1) и из Me.
// Шаг 1 — семейства сеткой, шаг 2 — карточки нишевых стилей из выбранных семейств, итог — профиль 1–3 стилей с весами

type Step = 'families' | 'cards' | 'result';

const WEAR = 'twin.wear';
const WEARS: [Wear, string][] = [
  ['men', 'Menswear'],
  ['women', 'Womenswear'],
  ['all', 'All'],
];

export default function StyleScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const isFirst = first === '1';
  const { style, setStyle, setOnboarded } = useStore();

  const [wear, setWearState] = useState<Wear>(() => {
    const w = readSetting(WEAR);
    return w === 'women' || w === 'all' ? w : 'men';
  });
  const [step, setStep] = useState<Step>(style && !isFirst ? 'result' : 'families');
  const [families, setFamilies] = useState<StyleFamily[]>([]);
  const [votes, setVotes] = useState<Partial<Record<StyleId, StyleVote>>>({});
  const [history, setHistory] = useState<StyleId[]>([]);
  // итог: свежий из опроса или сохранённый, если человек пришёл посмотреть
  const [profile, setProfile] = useState<StyleProfile | null>(style);

  const deck = families.flatMap((f) => stylesIn(f, wear));
  const card = deck[history.length];

  const setWear = (w: Wear) => {
    setWearState(w);
    writeSetting(WEAR, w === 'men' ? null : w);
  };

  const leave = () => {
    if (isFirst) {
      setOnboarded(true);
      router.replace('/');
    } else if (router.canGoBack()) router.back();
    else router.replace('/me');
  };

  const vote = (v: StyleVote) => {
    if (!card) return;
    const next = { ...votes, [card.id as StyleId]: v };
    setVotes(next);
    setHistory((h) => [...h, card.id as StyleId]);
    if (history.length + 1 >= deck.length) {
      setProfile(profileFromVotes(next));
      setStep('result');
    }
  };

  const undo = () => {
    if (!history.length) return setStep('families');
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setVotes(({ [last]: _, ...rest }) => rest as Partial<Record<StyleId, StyleVote>>);
  };

  const finishEarly = () => {
    setProfile(profileFromVotes(votes));
    setStep('result');
  };

  const restart = () => {
    setVotes({});
    setHistory([]);
    setStep('families');
  };

  // на ноутбуке: ← мимо, → нравится, ↑ очень, Backspace — назад (подписка обновляется с каждым ходом)
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 'cards') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') vote('skip');
      else if (e.key === 'ArrowRight') vote('like');
      else if (e.key === 'ArrowUp') vote('love');
      else if (e.key === 'Backspace') undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {step === 'cards' ? (
        <GlassButton icon="back" label={history.length ? 'Undo' : 'Back to families'} onPress={undo} />
      ) : isFirst && step === 'families' ? (
        <View style={{ width: 44 }} />
      ) : (
        <GlassButton icon="back" label="Back" onPress={step === 'result' && history.length ? undo : leave} />
      )}
      {step === 'cards' ? (
        <T size={13} color={t.muted} accessibilityLiveRegion="polite">
          {`${Math.min(history.length + 1, deck.length)} of ${deck.length}`}
        </T>
      ) : null}
      {isFirst ? (
        <Pressable onPress={leave} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T size={14} color={t.muted}>
            Skip for now
          </T>
        </Pressable>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 18 }} showsVerticalScrollIndicator={false}>
      {header}
      {step === 'families' ? (
        <Families
          width={width - 40}
          wear={wear}
          setWear={setWear}
          picked={families}
          toggle={(f) => setFamilies((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]))}
          next={() => {
            setVotes({});
            setHistory([]);
            setStep('cards');
          }}
        />
      ) : step === 'cards' && card ? (
        <Card key={card.id} style={card} wear={wear} index={history.length} width={width - 40} vote={vote} finish={history.length >= 3 ? finishEarly : null} />
      ) : (
        <Result profile={profile} isFirst={isFirst} save={() => (setStyle(profile), leave())} retake={restart} remove={style && !isFirst ? () => (setStyle(null), leave()) : null} />
      )}
    </ScrollView>
  );
}

/** Шаг 1: сетка семейств, можно выбрать сколько угодно */
function Families({ width, wear, setWear, picked, toggle, next }: { width: number; wear: Wear; setWear: (w: Wear) => void; picked: StyleFamily[]; toggle: (f: StyleFamily) => void; next: () => void }) {
  const { t } = useTheme();
  const tileW = (width - 10) / 2;
  const count = picked.reduce((n, f) => n + stylesIn(f, wear).length, 0);
  return (
    <>
      <View style={{ gap: 8 }}>
        <Label accent>Your style · 1 minute</Label>
        <T size={32} tracking={-0.03} lh={1.05} accessibilityRole="header">
          What feels like you?
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          Pick every family that’s close. Next, a few looks from each: like, love or not me. Outfits and Twin then dress you in your style.
        </T>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Show me" style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
        {WEARS.map(([w, label]) => {
          const on = wear === w;
          return (
            <Pressable key={w} onPress={() => setWear(w)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.ctaBg : 'transparent' }}>
              <T size={13} w={on ? 500 : 400} color={on ? t.ctaText : t.muted}>
                {label}
              </T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {STYLE_FAMILIES.map((f) => {
          const on = picked.includes(f);
          const inside = stylesIn(f, wear);
          const cover = inside[0];
          return (
            <Pressable
              key={f}
              onPress={() => toggle(f)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${FAMILY_NAME[f]}: ${inside.map((s) => s.name).join(', ')}`}
              style={{ width: tileW, height: tileW * 1.18, borderRadius: 20, overflow: 'hidden', backgroundColor: PHOTO_BG, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line }}>
              {cover ? <Image source={stylePic(cover.id as StyleId, wear, 0)} contentFit="cover" contentPosition="top" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessible={false} /> : null}
              <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' }} />
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: 11, gap: 2 }}>
                <T size={15} w={500} color="#F5F5F4">
                  {FAMILY_NAME[f]}
                </T>
                <T size={11} color="rgba(245,245,244,0.72)" numberOfLines={2} lh={1.3}>
                  {inside.map((s) => s.name).join(' · ')}
                </T>
              </View>
              {on ? (
                <View style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={15} color={t.onAccent} stroke={2.2} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Cta title={picked.length ? `See ${count} looks` : 'Pick at least one'} sub={picked.length ? `${picked.length} ${picked.length === 1 ? 'family' : 'families'} · about ${Math.max(1, Math.round((count * 4) / 60))} min` : 'Tap the families that feel close'} disabled={!picked.length} onPress={next} />
    </>
  );
}

/** Шаг 2: одна карточка стиля. Свайп вправо — нравится, влево — мимо; кнопки делают то же */
function Card({ style: s, wear, index, width, vote, finish }: { style: StyleGuide; wear: Wear; index: number; width: number; vote: (v: StyleVote) => void; finish: (() => void) | null }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  // на низком экране ноутбука кнопки должны быть видны без прокрутки: шапка, кнопки и подсказка ≈ 230px
  const { height: screenH } = useWindowDimensions();
  const height = Math.max(300, Math.min((width * 4) / 3, 520, screenH - insets.top - insets.bottom - 230));
  const x = useRef(new Animated.Value(0)).current;
  const voteRef = useRef(vote);
  voteRef.current = vote;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 90) {
          const right = g.dx > 0;
          Animated.timing(x, { toValue: right ? width * 1.4 : -width * 1.4, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => voteRef.current(right ? 'like' : 'skip'));
        } else Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start(),
    })
  ).current;

  const rotate = x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-8deg', '0deg', '8deg'] });
  const likeOpacity = x.interpolate({ inputRange: [20, 90], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = x.interpolate({ inputRange: [-90, -20], outputRange: [1, 0], extrapolate: 'clamp' });

  const button = (v: StyleVote, label: string, icon: 'close' | 'check' | 'heart') => {
    const main = v === 'love';
    return (
      <Pressable
        onPress={() => vote(v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${s.name}`}
        style={({ pressed }) => ({ flex: 1, minHeight: 56, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: main ? t.accent : t.surface, borderWidth: main ? 0 : 1, borderColor: t.line, opacity: pressed ? 0.8 : 1 })}>
        <Icon name={icon} size={18} color={main ? t.onAccent : t.text} stroke={1.9} />
        <T size={14} w={500} color={main ? t.onAccent : t.text}>
          {label}
        </T>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <Animated.View {...pan.panHandlers} accessible accessibilityLabel={`${s.name}. ${s.line}`} style={{ height, borderRadius: 26, overflow: 'hidden', backgroundColor: PHOTO_BG, userSelect: 'none', cursor: 'grab', transform: [{ translateX: x }, { rotate }] } as never}>
        {/* на вебе мышь иначе тянет саму картинку (drag-n-drop браузера) и свайп не срабатывает */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Image source={stylePic(s.id as StyleId, wear, index)} contentFit="cover" contentPosition="top" style={{ width: '100%', height: '100%' }} accessible={false} />
        </View>
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' }} />
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18, gap: 4 }}>
          <T size={11} w={600} upper color="rgba(245,245,244,0.7)">
            {FAMILY_NAME[s.family]}
          </T>
          <T size={28} tracking={-0.02} lh={1.05} color="#F5F5F4">
            {s.name}
          </T>
          <T size={14} lh={1.4} color="rgba(245,245,244,0.82)">
            {s.line}
          </T>
        </View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 18, left: 18, opacity: likeOpacity, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.accent }}>
          <T size={13} w={600} color={t.onAccent}>
            Like
          </T>
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 18, right: 18, opacity: skipOpacity, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(20,20,22,0.8)' }}>
          <T size={13} w={600} color="#F5F5F4">
            Not me
          </T>
        </Animated.View>
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {button('skip', 'Not me', 'close')}
        {button('like', 'Like', 'check')}
        {button('love', 'Love', 'heart')}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <T size={12} color={t.muted} style={{ flexShrink: 1 }}>
          {Platform.OS === 'web' && !('ontouchstart' in window) ? 'Drag the card, or use ← → ↑ keys' : 'Swipe right to like, left to skip'}
        </T>
        {finish ? (
          <Pressable onPress={finish} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={14} color={t.accent}>
              That’s enough
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Итог: 1–3 стиля с долями, цвета, что не предлагаем */
function Result({ profile, isFirst, save, retake, remove }: { profile: StyleProfile | null; isFirst: boolean; save: () => void; retake: () => void; remove: (() => void) | null }) {
  const { t } = useTheme();
  if (!profile) {
    return (
      <View style={{ gap: 14, flex: 1 }}>
        <T size={28} tracking={-0.02} lh={1.1} accessibilityRole="header">
          Nothing clicked yet
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          Try other families. Even one “like” is enough to start.
        </T>
        <View style={{ marginTop: 'auto' }}>
          <Cta title="Pick other families" onPress={retake} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 18, flex: 1 }}>
      <View style={{ gap: 8 }}>
        <Label accent>Your style</Label>
        <T size={32} tracking={-0.03} lh={1.05} accessibilityRole="header">
          {STYLES[profile.styles[0].id].name}
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          {STYLES[profile.styles[0].id].line}
        </T>
      </View>

      <View style={{ borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
        {profile.styles.map((s, i) => (
          <View key={s.id} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 8, borderTopWidth: i ? 1 : 0, borderColor: t.line }} accessible accessibilityLabel={`${STYLES[s.id].name}, ${s.weight} percent`}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <T size={15} w={500}>
                {STYLES[s.id].name}
              </T>
              <T size={13} color={t.muted}>
                {s.weight}%
              </T>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: t.line }}>
              <View style={{ width: `${s.weight}%`, height: 4, borderRadius: 2, backgroundColor: t.accent }} />
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Colours you go for</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {profile.colors.map((c) => (
            <View key={c} style={{ minHeight: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: t.line }}>
              <T size={13}>{c}</T>
            </View>
          ))}
        </View>
      </View>

      {profile.avoid.length ? (
        <T size={13} color={t.muted} lh={1.45}>
          {`Twin leaves out ${profile.avoid.map((id) => STYLES[id].name).join(', ')} unless you ask.`}
        </T>
      ) : null}

      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Cta title={isFirst ? 'Save and continue' : 'Save'} sub="Outfits and Twin follow it · change any time in Me" onPress={save} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={retake} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={14} color={t.text} style={{ textDecorationLine: 'underline' }}>
              Retake the quiz
            </T>
          </Pressable>
          {remove ? (
            <Pressable onPress={remove} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={14} color={t.warn}>
                Clear my style
              </T>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
