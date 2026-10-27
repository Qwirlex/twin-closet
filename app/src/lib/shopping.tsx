import { LIVE_STORE_IDS, type WatchItem } from '@twin/shared';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Item, Pic } from '@/data/demo';
import { deviceCountry } from '@/data/stores';
import { putWatch } from '@/lib/api';
import { readSetting, writeSetting } from '@/lib/storage';

// Любимые магазины, регион и вишлист (docs/spec-stores-wishlist.md).
// Вишлист живёт на телефоне; вещи живых магазинов уходят на сервер, он раз в сутки проверяет цену.

export interface Wish {
  id: string;
  name: string;
  meta: string;
  image: Pic;
  storeId: string | null;
  ref: string | null;
  url: string | null;
  price: number | null;
  currency: string | null;
  addedAt: string;
}

interface Shopping {
  country: string;
  setCountry: (code: string) => void;
  favoriteIds: string[];
  toggleFavorite: (storeId: string) => void;
  wishlist: Wish[];
  isWished: (id: string) => boolean;
  toggleWish: (item: Item) => void;
  removeWish: (id: string) => void;
  /** последняя проверка цены сервером */
  watch: (id: string) => WatchItem | undefined;
  /** есть ли связь с сервером цен */
  watchError: string | null;
}

const ShoppingContext = createContext<Shopping | null>(null);
const KEYS = { country: 'twin.country', favorites: 'twin.stores', wishlist: 'twin.wishlist' };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = readSetting(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** В демо-аккаунте любимые — три живых магазина */
const DEFAULT_FAVORITES = [...LIVE_STORE_IDS];

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState(() => readSetting(KEYS.country) ?? deviceCountry());
  const [favoriteIds, setFavorites] = useState<string[]>(() => readJson(KEYS.favorites, DEFAULT_FAVORITES));
  const [wishlist, setWishlist] = useState<Wish[]>(() => readJson(KEYS.wishlist, []));
  const [watched, setWatched] = useState<WatchItem[]>([]);
  const [watchError, setWatchError] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => writeSetting(KEYS.favorites, JSON.stringify(favoriteIds)), [favoriteIds]);
  useEffect(() => writeSetting(KEYS.wishlist, JSON.stringify(wishlist)), [wishlist]);

  // вишлист на телефоне главный: при каждом изменении отправляем весь список (и пустой — чтобы сервер забыл удалённое),
  // в ответ сервер отдаёт последние проверки цен
  useEffect(() => {
    const live = wishlist.filter((w) => w.storeId && (LIVE_STORE_IDS as readonly string[]).includes(w.storeId));
    const send = () =>
      putWatch(live.map((w) => ({ id: w.id, name: w.name, storeId: w.storeId!, ref: w.ref, url: w.url, price: w.price, currency: w.currency, country })))
        .then((items) => {
          setWatched(items);
          setWatchError(null);
        })
        .catch((e) => setWatchError(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          first.current = false;
        });
    const t = setTimeout(send, first.current ? 0 : 600);
    return () => clearTimeout(t);
  }, [wishlist, country]);

  const value = useMemo<Shopping>(
    () => ({
      country,
      setCountry: (code) => {
        setCountryState(code);
        writeSetting(KEYS.country, code);
      },
      favoriteIds,
      toggleFavorite: (id) => setFavorites((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
      wishlist,
      isWished: (id) => wishlist.some((w) => w.id === id),
      toggleWish: (it) =>
        setWishlist((list) =>
          list.some((w) => w.id === it.id)
            ? list.filter((w) => w.id !== it.id)
            : [{ id: it.id, name: it.name, meta: it.meta, image: it.image, storeId: it.shop?.storeId ?? null, ref: it.shop?.ref ?? null, url: it.shop?.url ?? null, price: it.shop?.price ?? null, currency: it.shop?.currency ?? null, addedAt: new Date().toISOString() }, ...list]
        ),
      removeWish: (id) => setWishlist((list) => list.filter((w) => w.id !== id)),
      watch: (id) => watched.find((w) => w.id === id),
      watchError,
    }),
    [country, favoriteIds, wishlist, watched, watchError]
  );

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

export function useShopping(): Shopping {
  const value = useContext(ShoppingContext);
  if (!value) throw new Error('useShopping вне ShoppingProvider');
  return value;
}

/** «€39.95» — цена с валютой */
export function money(price: number | null | undefined, currency: string | null | undefined): string {
  if (price === null || price === undefined) return '';
  const sign = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' || !currency ? '€' : `${currency} `;
  return `${sign}${price.toFixed(2)}`;
}
