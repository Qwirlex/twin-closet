import { Image } from 'expo-image';
import { View } from 'react-native';

import { T, Tag } from '@/components/ui';
import type { Item } from '@/data/demo';
import { useTheme } from '@/theme/theme';

/** Плашка вещи: surface2, вещь по центру, подпись в две строки */
export function GarmentTile({ item, height = 168 }: { item: Item; height?: number }) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 8 }} accessible accessibilityLabel={`${item.name}, ${item.meta}${item.isNew ? ', new' : ''}`}>
      <View style={{ height, borderRadius: 18, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={item.image} contentFit="contain" style={{ width: '82%', height: '82%' }} accessible={false} />
        {item.isNew ? (
          <View style={{ position: 'absolute', top: 10, left: 10 }}>
            <Tag kind="new" />
          </View>
        ) : null}
      </View>
      <View style={{ gap: 1 }}>
        <T size={14} w={500} numberOfLines={1}>
          {item.name}
        </T>
        <T size={12} color={t.muted} numberOfLines={1}>
          {item.meta}
        </T>
      </View>
    </View>
  );
}

/** Миниатюра вещи на плашке */
export function Thumb({ item, width = 64, height = 72, radius = 14 }: { item: Item; width?: number; height?: number; radius?: number }) {
  const { t } = useTheme();
  return (
    <View style={{ width, height, borderRadius: radius, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Image source={item.image} contentFit={item.pending ? 'cover' : 'contain'} style={item.pending ? { width: '100%', height: '100%' } : { width: '84%', height: '84%' }} accessible={false} />
    </View>
  );
}

/** Похожие вещи веером: две миниатюры внахлёст под −8°/+6° и бейдж-счётчик */
export function SimilarFan({ items }: { items: Item[] }) {
  const { t } = useTheme();
  const shown = items.slice(0, 2);
  const card = { position: 'absolute', width: 42, height: 48, borderRadius: 10, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ width: 74, height: 56 }}>
      {shown.map((it, i) => (
        <View key={it.id} style={[card, i === 0 ? { left: shown.length > 1 ? 0 : 12, top: 4, transform: [{ rotate: shown.length > 1 ? '-8deg' : '0deg' }] } : { left: 22, top: 2, transform: [{ rotate: '6deg' }] }]}>
          <Image source={it.image} contentFit="contain" style={{ width: 34, height: 40 }} accessible={false} />
        </View>
      ))}
      {items.length > 0 ? (
        <View style={{ position: 'absolute', right: 2, top: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T size={11} w={600} color={t.onAccent}>
            {items.length}
          </T>
        </View>
      ) : null}
    </View>
  );
}
