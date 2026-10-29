import { isLiveStore, LIVE_STORES, type PricePoint } from '@twin/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Icon } from '@/components/icons';
import { useFrameWidth } from '@/components/layout';
import { Cta, Glass, GlassButton, GoldRim, Label, T } from '@/components/ui';
import { countryName, storeById } from '@/data/stores';
import { getPriceHistory } from '@/lib/api';
import { money, useShopping } from '@/lib/shopping';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT } from '@/theme/tokens';

// Вещь из вишлиста: цена сейчас и при добавлении, история проверок, своя цель «скажи, когда дешевле»

export default function WishScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wishlist, watch, serverHasKey, sale, setTarget, removeWish, country } = useShopping();
  const { addToTryOn } = useStore();
  const wish = wishlist.find((w) => w.id === id);
  const w = wish ? watch(wish.id) : undefined;
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [target, setTargetText] = useState(wish?.targetPrice ? String(wish.targetPrice) : '');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (wish?.storeId) getPriceHistory(wish.id).then(setPoints).catch(() => setPoints([]));
  }, [wish?.id, wish?.storeId, w?.checkedAt]);

  if (!wish) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 16 }}>
        <GlassButton icon="back" label="Back" onPress={() => router.back()} />
        <T color={t.muted}>This piece is no longer on your wishlist.</T>
      </View>
    );
  }

  const store = storeById(wish.storeId);
  const storeSale = sale(wish.storeId);
  const now = w?.lastPrice ?? wish.price;
  const was = w?.onSale && wish.price ? wish.price : null;

  const status = !store
    ? 'Add a store to this piece to watch its price.'
    : !store.live
      ? `Price watch for ${store.name} is coming soon.`
      : !serverHasKey
        ? 'Price checks start once the Meta key is connected.'
        : w?.pendingPrice
          ? `Saw ${money(w.pendingPrice, wish.currency)} — checking again before telling you.`
          : w?.checkedAt
            ? `Checked ${ago(w.checkedAt)}${w.source ? ` · ${host(w.source)}` : ''}`
            : 'First check within the hour.';

  const saveTarget = () => {
    const n = Number.parseFloat(target.replace(',', '.'));
    if (!target.trim()) {
      setTarget(wish.id, null);
      setNote('Target removed.');
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setNote('Type a price, for example 29.95.');
      return;
    }
    setTarget(wish.id, Math.round(n * 100) / 100);
    setNote(`We will tell you when it is ${money(n, wish.currency)} or less.`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <GlassButton
          icon="heart"
          filled
          label="Remove from wishlist"
          onPress={() => {
            removeWish(wish.id);
            router.back();
          }}
        />
      </View>

      <View style={{ height: 280, borderRadius: 24, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {typeof wish.image === 'object' && !wish.image.uri ? <Icon name="link" size={32} color={t.muted} /> : <Image source={wish.image} contentFit="contain" style={{ width: '80%', height: '86%' }} accessibilityLabel={wish.name} />}
        {w?.onSale || w?.hitTarget ? (
          <View style={{ position: 'absolute', top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.accent }}>
            <T size={11} w={600} upper tracking={0.1} color={t.onAccent}>
              {w.hitTarget ? 'Target hit' : 'Price drop'}
            </T>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <T size={26} tracking={-0.03} accessibilityRole="header">
          {wish.name}
        </T>
        <T size={14} color={t.muted}>
          {[store?.name, wish.ref ? `REF ${wish.ref}` : null, countryName(country)].filter(Boolean).join(' · ')}
        </T>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <T size={40} w={300} tracking={-0.03}>
          {money(now, wish.currency) || 'No price yet'}
        </T>
        {was ? (
          <T size={16} color={t.muted} style={{ textDecorationLine: 'line-through' }}>
            {money(was, wish.currency)}
          </T>
        ) : null}
      </View>
      <View style={{ gap: 4 }}>
        {w?.lowest30 ? (
          <T size={13} color={t.muted}>
            Lowest in 30 days: {money(w.lowest30, wish.currency)}
          </T>
        ) : null}
        <T size={13} color={t.muted} lh={1.4} accessibilityLiveRegion="polite">
          {status}
        </T>
        {isLiveStore(wish.storeId) && LIVE_STORES[wish.storeId].sizing ? (
          <T size={13} color={t.warn} lh={1.4}>
            {LIVE_STORES[wish.storeId].sizing}
          </T>
        ) : null}
        {storeSale?.onSale ? (
          <T size={13} color={t.accent}>
            {store?.name} sale is on in {countryName(storeSale.country)} — checked daily now.
          </T>
        ) : null}
      </View>

      <PriceChart points={points} width={width - 40} />

      <GoldRim radius={20} style={{ padding: 14, gap: 10 }}>
        <Label accent>Tell me when it is cheaper</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Glass style={{ flex: 1, height: 48, paddingHorizontal: 16, justifyContent: 'center' }}>
            <TextInput
              value={target}
              onChangeText={setTargetText}
              onSubmitEditing={saveTarget}
              placeholder={wish.price ? `Under ${money(wish.price * 0.8, wish.currency)}` : 'Target price'}
              placeholderTextColor={t.muted}
              keyboardType="decimal-pad"
              accessibilityLabel="Target price"
              style={{ fontFamily: FONT[400], fontSize: 15, color: t.text, outlineStyle: 'none' } as never}
            />
          </Glass>
          <Pressable onPress={saveTarget} accessibilityRole="button" style={{ height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: t.ctaBg, justifyContent: 'center' }}>
            <T size={14} w={500} color={t.ctaText}>
              Save
            </T>
          </Pressable>
        </View>
        {note ? (
          <T size={13} color={t.muted} accessibilityLiveRegion="polite">
            {note}
          </T>
        ) : null}
      </GoldRim>

      <Cta
        title="Try it on"
        sub="With pieces from your closet"
        onPress={() => {
          addToTryOn({ id: wish.id, name: wish.name, meta: wish.meta, kind: null, image: wish.image, via: 'Link', shop: { price: now, url: wish.url, currency: wish.currency, storeId: wish.storeId, ref: wish.ref } });
          router.push('/try');
        }}
      />
      {wish.url ? (
        <Pressable onPress={() => Linking.openURL(wish.url!)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, alignSelf: 'center' }}>
          <Icon name="open" size={16} color={t.text} />
          <T size={14} w={500}>
            Open in {store?.name ?? 'store'}
          </T>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

/** История цены: линия по проверкам, точки — каждая проверка */
function PriceChart({ points, width }: { points: PricePoint[]; width: number }) {
  const { t } = useTheme();
  if (points.length < 2) {
    return (
      <View style={{ paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.line }}>
        <T size={13} color={t.muted}>
          Price history appears after a couple of checks.
        </T>
      </View>
    );
  }
  const h = 90;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const xy = points.map((p, i) => [8 + (i / (points.length - 1)) * (width - 16), max === min ? h / 2 : 8 + ((max - p.price) / (max - min)) * (h - 16)] as const);
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`Price history: ${points.length} checks, from ${min.toFixed(2)} to ${max.toFixed(2)}`}>
      <Label>Price history · {points.length} checks</Label>
      <Svg width={width} height={h}>
        <Polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={t.accent} strokeWidth={1.6} />
        {xy.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.5} fill={t.accent} />
        ))}
      </Svg>
    </View>
  );
}

function ago(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
