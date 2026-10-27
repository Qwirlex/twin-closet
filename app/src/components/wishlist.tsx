import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { Icon } from '@/components/icons';
import { GoldRim, Label, T } from '@/components/ui';
import { storeById } from '@/data/stores';
import { money, useShopping, type Wish } from '@/lib/shopping';
import { useTheme } from '@/theme/theme';

/** Closet › Wishlist: вещи, которые хочется, с ценой и скидкой */
export function WishlistView({ tileW }: { tileW: number }) {
  const { t } = useTheme();
  const { wishlist, watch, favoriteIds } = useShopping();
  const drops = wishlist.filter((w) => watch(w.id)?.onSale);

  return (
    <View style={{ gap: 16 }}>
      {drops.length ? (
        <GoldRim radius={18} style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 3 }}>
          <Label accent>{drops.length === 1 ? '1 price drop' : `${drops.length} price drops`}</Label>
          <T size={14} lh={1.4}>
            {drops.map((d) => d.name).join(', ')} {drops.length === 1 ? 'is' : 'are'} cheaper than when you saved {drops.length === 1 ? 'it' : 'them'}.
          </T>
        </GoldRim>
      ) : null}

      <Pressable onPress={() => router.push('/stores')} accessibilityRole="button" accessibilityLabel={`Your stores: ${favoriteIds.length}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <T size={12} w={500} upper>
          {wishlist.length} {wishlist.length === 1 ? 'piece' : 'pieces'}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="tag" size={16} color={t.muted} />
          <T size={13} color={t.muted}>
            Your stores · {favoriteIds.length}
          </T>
        </View>
      </Pressable>

      {wishlist.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {wishlist.map((w) => (
            <View key={w.id} style={{ width: tileW }}>
              <WishTile wish={w} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <T size={17} w={500}>
            Nothing saved yet
          </T>
          <T size={14} color={t.muted} lh={1.45}>
            Tap the heart on any piece in Try on, or ask Twin to find something in your stores. If a saved piece from Zara, Bershka or Pull & Bear gets cheaper, it shows here.
          </T>
        </View>
      )}
    </View>
  );
}

function WishTile({ wish }: { wish: Wish }) {
  const { t } = useTheme();
  const { watch, removeWish } = useShopping();
  const w = watch(wish.id);
  const store = storeById(wish.storeId);
  const sale = w?.onSale && w.lastPrice !== null;
  const off = sale && wish.price ? Math.round((1 - w!.lastPrice! / wish.price) * 100) : 0;
  const price = sale ? money(w!.lastPrice, wish.currency) : money(wish.price, wish.currency);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 168, borderRadius: 18, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {typeof wish.image === 'object' && !wish.image.uri ? (
          <Icon name="link" size={24} color={t.muted} />
        ) : (
          <Image source={wish.image} contentFit="contain" style={{ width: '82%', height: '82%' }} accessible={false} />
        )}
        {sale ? (
          <View style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.accent }}>
            <T size={10} w={600} tracking={0.1} color={t.onAccent}>
              {off > 0 ? `−${off}%` : 'SALE'}
            </T>
          </View>
        ) : null}
        <Pressable onPress={() => removeWish(wish.id)} accessibilityRole="button" accessibilityLabel={`Remove ${wish.name} from wishlist`} style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="heart" size={20} color={t.accent} filled />
        </Pressable>
      </View>
      <View style={{ gap: 1 }}>
        <T size={14} w={500} numberOfLines={1}>
          {wish.name}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T size={12} color={t.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {[store?.name, price].filter(Boolean).join(' · ') || wish.meta}
          </T>
          {sale && wish.price ? (
            <T size={12} color={t.muted} style={{ textDecorationLine: 'line-through' }}>
              {money(wish.price, wish.currency)}
            </T>
          ) : null}
        </View>
        {wish.url ? (
          <Pressable onPress={() => Linking.openURL(wish.url!)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
            <Icon name="open" size={14} color={t.text} />
            <T size={12} w={500}>
              Open in {store?.name ?? 'store'}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
