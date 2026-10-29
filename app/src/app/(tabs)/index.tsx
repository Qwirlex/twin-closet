import type { GarmentKind } from '@twin/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { GarmentTile } from '@/components/garments';
import { WishlistView } from '@/components/wishlist';
import { Icon } from '@/components/icons';
import { TabScreen, useFrameWidth } from '@/components/layout';
import { ArrowDot, Glass, GlassButton, GoldRim, Label, Orb, T, ThemeToggle } from '@/components/ui';
import { KIND_LABEL } from '@/data/demo';
import { useShopping } from '@/lib/shopping';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT } from '@/theme/tokens';

export default function ClosetScreen() {
  const { t } = useTheme();
  const { closet, scans, isKnownScan, markScanSeen } = useStore();
  // скан, начатый на подключённом телефоне и ещё не открытый здесь — показываем, как он прошёл
  const phoneScan = scans.filter((s) => !isKnownScan(s.jobId)).at(-1);
  const [kind, setKind] = useState<GarmentKind | 'all'>('all');
  const [query, setQuery] = useState<string | null>(null);
  const [view, setView] = useState<'closet' | 'wishlist'>('closet');
  const { wishlist, freshDrops, dismissDrops } = useShopping();
  const tileW = (useFrameWidth() - 40 - 12) / 2;

  const kinds = [...new Set(closet.map((i) => i.kind).filter((k): k is GarmentKind => !!k))];
  const q = query?.trim().toLowerCase() ?? '';
  const items = closet.filter((i) => (kind === 'all' || i.kind === kind) && (!q || `${i.name} ${i.meta}`.toLowerCase().includes(q)));
  // на круге категории — последняя вещь этого вида (в демо так видны светлые вещи, а не чёрные на тёмном)
  const cats = [{ key: 'all' as const, name: 'All', image: closet[0]?.image }, ...kinds.map((k) => ({ key: k, name: KIND_LABEL[k], image: closet.filter((i) => i.kind === k).pop()!.image }))];

  return (
    <TabScreen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 4 }}>
          <T size={11} w={500} upper tracking={0.18} color={t.muted}>
            Twin Closet
          </T>
          <T size={36} tracking={-0.03} lh={1} accessibilityRole="header">
            Closet
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => router.push('/twin')} accessibilityRole="button" accessibilityLabel="Ask Twin, your AI stylist">
            <Glass style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Orb size={22} />
            </Glass>
          </Pressable>
          <GlassButton icon={query === null ? 'search' : 'close'} label={query === null ? 'Search closet' : 'Close search'} onPress={() => setQuery(query === null ? '' : null)} />
          <ThemeToggle />
        </View>
      </View>

      {freshDrops.length ? (
        <Pressable
          onPress={() => {
            setView('wishlist');
            dismissDrops();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Since you were away: ${freshDrops.length} price drops. Open wishlist`}>
          <GoldRim radius={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingLeft: 14, paddingRight: 10 }}>
            <Icon name="tag" size={20} color={t.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label accent>Since you were away</Label>
              <T size={14} numberOfLines={2}>
                {freshDrops.length === 1 ? `${freshDrops[0].name} got cheaper` : `${freshDrops.length} pieces on your wishlist got cheaper`}
              </T>
            </View>
            <Icon name="next" size={18} color={t.muted} />
          </GoldRim>
        </Pressable>
      ) : null}

      {phoneScan ? (
        <Pressable
          onPress={() => {
            markScanSeen(phoneScan.jobId);
            router.push({ pathname: '/scan', params: { job: phoneScan.jobId, mode: phoneScan.kind === 'body_scan' ? 'body' : 'rail' } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`From your phone: ${phoneScan.kind === 'body_scan' ? 'body scan' : 'closet scan'}. See how it went`}>
          <GoldRim radius={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingLeft: 14, paddingRight: 10 }}>
            <Icon name="phone" size={20} color={t.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label accent>From your phone</Label>
              <T size={14} numberOfLines={2}>
                {phoneScan.kind === 'body_scan' ? 'Body scan' : 'Closet scan'} — see how it went
              </T>
            </View>
            <Icon name="next" size={18} color={t.muted} />
          </GoldRim>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: t.line }} accessibilityRole="tablist">
        {(
          [
            ['closet', 'My closet'],
            ['wishlist', `Wishlist · ${wishlist.length}`],
          ] as const
        ).map(([key, label]) => {
          const on = view === key;
          return (
            <Pressable key={key} onPress={() => setView(key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ minHeight: 44, justifyContent: 'center', marginBottom: -1, borderBottomWidth: 1.5, borderBottomColor: on ? t.accent : 'transparent' }}>
              <T size={14} w={on ? 500 : 400} color={on ? t.text : t.muted}>
                {label}
              </T>
            </Pressable>
          );
        })}
      </View>

      {view === 'wishlist' ? <WishlistView tileW={tileW} /> : null}

      {view === 'closet' && query !== null ? (
        <Glass style={{ height: 48, paddingHorizontal: 18, justifyContent: 'center' }}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search your closet"
            placeholderTextColor={t.muted}
            accessibilityLabel="Search your closet"
            style={{ fontFamily: FONT[400], fontSize: 15, color: t.text, outlineStyle: 'none' } as never}
          />
        </Glass>
      ) : null}

      {view === 'closet' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} style={{ marginHorizontal: -20 }}>
            <View style={{ width: 6 }} />
            {cats.map((c) => {
              const on = c.key === kind;
              return (
                <Pressable key={c.key} onPress={() => setKind(c.key)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={c.name} style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.surface2, borderWidth: 1.5, borderColor: on ? t.accent : t.line, alignItems: 'center', justifyContent: 'center' }}>
                    {c.image ? <Image source={c.image} contentFit="contain" style={{ width: 40, height: 40 }} accessible={false} /> : null}
                  </View>
                  <T size={12} w={on ? 600 : 400} color={on ? t.text : t.muted}>
                    {c.name}
                  </T>
                </Pressable>
              );
            })}
            <View style={{ width: 6 }} />
          </ScrollView>

          <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel="Video scan. Add your whole rail in 30 seconds">
            <GoldRim style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingLeft: 17, paddingRight: 9 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Label accent>Video scan</Label>
                <T size={15} w={500}>
                  Add your whole rail in 30 seconds
                </T>
              </View>
              <ArrowDot />
            </GoldRim>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T size={12} w={500} upper>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </T>
            <T size={13} color={t.muted}>
              Recently added
            </T>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {items.map((it) => (
              <Pressable key={it.id} onPress={() => router.push({ pathname: '/piece/[id]', params: { id: it.id } })} accessibilityRole="button" accessibilityLabel={`${it.name}: fit and measurements`} style={({ pressed }) => ({ width: tileW, opacity: pressed ? 0.85 : 1 })}>
                <GarmentTile item={it} />
              </Pressable>
            ))}
            {items.length === 0 ? (
              <T size={14} color={t.muted}>
                Nothing matches. Try another word or category.
              </T>
            ) : null}
          </View>
        </>
      ) : null}
    </TabScreen>
  );
}
