import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TabScreen, useFrameWidth } from '@/components/layout';
import { Trending } from '@/components/trending';
import { PhotoChip, T, Tag, ThemeToggle } from '@/components/ui';
import { LOOKS, OWN_LOOKS, type DemoLook } from '@/data/demo';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { PHOTO_BG } from '@/theme/tokens';

export default function LooksScreen() {
  const { t } = useTheme();
  const { savedIds, item } = useStore();
  const [tab, setTab] = useState<'saved' | 'ideas' | 'trends'>('saved');
  const tileW = (useFrameWidth() - 40 - 12) / 2;
  const saved = LOOKS.filter((l) => savedIds.includes(l.id));
  const looks = tab === 'saved' ? saved : OWN_LOOKS;

  const meta = (l: DemoLook) => l.itemIds.map((id) => item(id)?.name ?? id).join(', ');
  const newCount = (l: DemoLook) => l.itemIds.filter((id) => item(id)?.via).length;

  return (
    <TabScreen gap={18}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <T size={36} tracking={-0.03} lh={1} accessibilityRole="header">
          Looks
        </T>
        <ThemeToggle />
      </View>

      <View style={{ flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: t.line }} accessibilityRole="tablist">
        {(
          [
            ['saved', `Saved · ${saved.length}`],
            ['ideas', 'Ideas from your closet'],
            ['trends', 'Trending'],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ minHeight: 44, justifyContent: 'center', marginBottom: -1, borderBottomWidth: 1.5, borderBottomColor: on ? t.accent : 'transparent' }}>
              <T size={14} w={on ? 500 : 400} color={on ? t.text : t.muted}>
                {label}
              </T>
            </Pressable>
          );
        })}
      </View>

      {tab === 'trends' ? <Trending /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 14, display: tab === 'trends' ? 'none' : 'flex' }}>
        {looks.map((l) => {
          const n = newCount(l);
          const angles = Object.keys(l.renders).length;
          return (
            <Pressable key={l.id} onPress={() => router.push({ pathname: '/result', params: { look: l.id } })} accessibilityRole="button" accessibilityLabel={`${l.title}: ${meta(l)}`} style={{ width: tileW, gap: 8 }}>
              <View style={{ height: 206, borderRadius: 20, backgroundColor: PHOTO_BG, overflow: 'hidden' }}>
                <Image source={l.renders.front} contentFit="cover" contentPosition={{ top: '18%', left: '50%' }} style={{ position: 'absolute', inset: 0 }} accessible={false} />
                {n > 0 ? (
                  <View style={{ position: 'absolute', top: 10, left: 10 }}>
                    <Tag kind="new" text={`${n} new`} />
                  </View>
                ) : null}
                <PhotoChip style={{ position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 9, paddingVertical: 4 }}>{angles === 4 ? '4 angles' : 'Front'}</PhotoChip>
              </View>
              <View style={{ gap: 1 }}>
                <T size={15} w={500}>
                  {l.title}
                </T>
                <T size={12} color={t.muted} numberOfLines={2}>
                  {meta(l)}
                </T>
              </View>
            </Pressable>
          );
        })}
        {looks.length === 0 ? (
          <T size={14} color={t.muted} lh={1.45}>
            No saved looks yet. Open a try-on and tap the bookmark to keep a look here.
          </T>
        ) : null}
      </View>
    </TabScreen>
  );
}
