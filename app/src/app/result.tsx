import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AngleDial } from '@/components/angle-dial';
import { CompareRender } from '@/components/compare';
import { SimilarFan } from '@/components/garments';
import { Icon } from '@/components/icons';
import { useFrameWidth } from '@/components/layout';
import { Cta, Glass, GlassButton, GoldRim, Label, PhotoChip, T } from '@/components/ui';
import { ANGLES, LOOKS, ME, OWN_LOOKS, type Item } from '@/data/demo';
import { money, useShopping } from '@/lib/shopping';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { PHOTO_GLASS } from '@/theme/tokens';

export default function ResultScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const { look: lookParam } = useLocalSearchParams<{ look?: string }>();
  const { item, looksForTryOn, similarOwned, savedIds, toggleSaved } = useStore();

  const own = OWN_LOOKS.some((l) => l.id === lookParam);
  const looks = own ? OWN_LOOKS : lookParam ? LOOKS : looksForTryOn();
  const [index, setIndex] = useState(() => Math.max(0, looks.findIndex((l) => l.id === lookParam)));
  const [angle, setAngle] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const { wishlist, watch } = useShopping();

  const look = looks[index] ?? LOOKS[0];
  const angleKey = ANGLES[angle].key;
  const after = look.renders[angleKey] ?? null;
  const pieces = look.itemIds.map((id) => item(id)).filter((i): i is Item => !!i);
  const fresh = pieces.filter((p) => p.via);
  const similar = [...new Map(fresh.flatMap((p) => similarOwned(p)).filter((s) => !look.itemIds.includes(s.id)).map((s) => [s.id, s])).values()];
  const saved = savedIds.includes(look.id);
  const prices = fresh.map((p) => p.shop?.price).filter((p): p is number => typeof p === 'number');
  const urls = fresh.map((p) => p.shop?.url).filter((u): u is string => !!u);

  // вещи образа из вишлиста, которые подешевели (подтверждено сервером цен)
  const cheaper = wishlist.filter((w) => look.itemIds.includes(w.id) && watch(w.id)?.onSale && w.price !== null && watch(w.id)!.lastPrice !== null);
  const saving = cheaper.reduce((sum, w) => sum + (w.price! - watch(w.id)!.lastPrice!), 0);

  const step = (d: number) => {
    setIndex((i) => (i + d + looks.length) % looks.length);
    setHint(null);
  };

  const ownText = similar.length
    ? `You already own ${list(similar.map((s) => s.name.toLowerCase()))}. ${capital(list(fresh.map((p) => p.name.toLowerCase())))} would be new.`
    : fresh.length
      ? `Nothing like ${list(fresh.map((p) => p.name.toLowerCase()))} in your closet yet.`
      : 'Every piece here is already yours.';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
      <CompareRender
        key={look.id}
        width={width}
        top={insets.top + 56}
        before={ME[angleKey]}
        after={after}
        overlay={
          !after ? (
            <PhotoChip icon="refresh" style={{ position: 'absolute', alignSelf: 'center', bottom: 18 }}>
              {ANGLES[angle].label} view renders on request
            </PhotoChip>
          ) : null
        }>
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <GlassButton variant="photo" icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/try'))} />
          {looks.length > 1 ? (
            <Glass variant="photo" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
              <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Previous outfit" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="back" size={16} color={PHOTO_GLASS.text} stroke={1.8} />
              </Pressable>
              <T size={13} w={500} color={PHOTO_GLASS.text} accessibilityLiveRegion="polite">
                Look {index + 1} of {looks.length}
              </T>
              <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="Next outfit" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="next" size={16} color={PHOTO_GLASS.text} stroke={1.8} />
              </Pressable>
            </Glass>
          ) : (
            <PhotoChip>{look.title}</PhotoChip>
          )}
          <GlassButton variant="photo" icon="bookmark" iconSize={18} filled={saved} label={saved ? 'Remove from saved looks' : 'Save outfit'} accessibilityState={{ selected: saved }} onPress={() => toggleSaved(look.id)} />
        </View>
      </CompareRender>

      <View style={{ paddingTop: 14, paddingHorizontal: 20, gap: 14 }}>
        <AngleDial value={angle} onChange={setAngle} rendered={ANGLES.map((a) => !!look.renders[a.key])} />

        <View style={{ gap: 2 }}>
          <T size={15} w={500}>
            {look.title}
          </T>
          <T size={13} color={t.muted} lh={1.4}>
            {look.note}
          </T>
        </View>

        {cheaper.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            <Icon name="tag" size={16} color={t.accent} />
            <T size={14} color={t.accent} style={{ flex: 1 }}>
              This look is {money(saving, cheaper[0].currency)} cheaper now: {list(cheaper.map((c) => c.name.toLowerCase()))} on sale.
            </T>
          </View>
        ) : null}

        <GoldRim radius={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 13 }}>
          {similar.length ? <SimilarFan items={similar} /> : null}
          <View style={{ flex: 1, gap: 3 }}>
            <Label accent>{similar.length ? 'Already in your closet' : 'New to your closet'}</Label>
            <T size={14} lh={1.4}>
              {ownText}
            </T>
          </View>
        </GoldRim>

        {fresh.length ? (
          <Cta
            title={`Buy ${fresh.length} new ${fresh.length === 1 ? 'piece' : 'pieces'}`}
            sub={prices.length ? `€${prices.reduce((a, b) => a + b, 0).toFixed(2)} · ${fresh.length} ${fresh.length === 1 ? 'store' : 'stores'}` : 'Demo pieces · no store links yet'}
            onPress={() => {
              if (urls[0]) Linking.openURL(urls[0]);
              else setHint('Demo pieces have no store link. Add a product link or a screenshot with a price and the button opens the store.');
            }}
          />
        ) : null}
        {hint ? (
          <T size={13} color={t.muted} lh={1.4} accessibilityLiveRegion="polite">
            {hint}
          </T>
        ) : null}
      </View>
    </ScrollView>
  );
}

function list(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
