import { LIVE_STORE_IDS, type StoreSale, type WatchItem } from '@twin/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CLOSET, SHOP, type Item, type Pic } from '@/data/demo';
import { deviceCountry } from '@/data/stores';
import { getWatch, putWatch, type WatchState } from '@/lib/api';
import { askNotifications, notifyDrops } from '@/lib/notify';
import { readSetting, writeSetting } from '@/lib/storage';
import { useSyncedDoc } from '@/lib/sync';

// Любимые магазины, регион и вишлист (docs/spec-stores-wishlist.md).
// Вишлист и любимые магазины — общий раздел «wishlist» (устройство + сервер, его видит и телефон, подключённый по QR);
// вещи живых магазинов уходят на сервер, он проверяет цены (раз в неделю, в распродажу — каждый день).

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
  /** «скажи, когда будет дешевле» */
  targetPrice: number | null;
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
  /** есть ли у сервера ключ Meta — без него цены не проверяются */
  serverHasKey: boolean;
  sale: (storeId: string | null) => StoreSale | undefined;
  setTarget: (id: string, price: number | null) => void;
  /** новые скидки с прошлого раза — для баннера при открытии */
  freshDrops: Wish[];
  dismissDrops: () => void;
}

const ShoppingContext = createContext<Shopping | null>(null);
const KEYS = { country: 'twin.country', favorites: 'twin.stores', wishlist: 'twin.wishlist', seen: 'twin.seenDrops' };

/** Скидка = подтверждённое снижение или цель достигнута; ключ меняется с ценой, чтобы новое снижение снова показалось */
const dropKey = (w: WatchItem) => (w.onSale || w.hitTarget ? `${w.id}@${w.lastPrice}` : null);

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

interface WishDoc {
  wishlist: Wish[];
  favorites: string[];
}

const DEMO_IMAGES = new Map<string, Pic>([...CLOSET, ...SHOP].map((i) => [i.id, i.image]));

/** Вещь вишлиста из памяти или с другого устройства: картинку демо-вещи берём по id — встроенная ссылка там не откроется */
function readWish(raw: unknown): Wish | null {
  const w = raw as Partial<Wish> | null;
  if (!w || typeof w.id !== 'string' || typeof w.name !== 'string') return null;
  const uri = (w.image as { uri?: unknown } | undefined)?.uri;
  const image: Pic = typeof uri === 'string' && uri ? { uri } : (DEMO_IMAGES.get(w.id) ?? { uri: '' });
  return { meta: '', storeId: null, ref: null, url: null, price: null, currency: null, targetPrice: null, addedAt: new Date(0).toISOString(), ...w, image } as Wish;
}

function readWishDoc(raw: unknown): WishDoc | null {
  const d = raw as Partial<Record<keyof WishDoc, unknown>> | null;
  if (!d || typeof d !== 'object') return null;
  return {
    wishlist: Array.isArray(d.wishlist) ? d.wishlist.map(readWish).filter((w): w is Wish => !!w) : [],
    favorites: Array.isArray(d.favorites) ? d.favorites.filter((x): x is string => typeof x === 'string') : DEFAULT_FAVORITES,
  };
}

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState(() => readSetting(KEYS.country) ?? deviceCountry());
  // первый запуск после обновления подхватывает вишлист и магазины из старых ключей
  const [doc, change] = useSyncedDoc<WishDoc>('wishlist', () => readWishDoc({ wishlist: readJson(KEYS.wishlist, []), favorites: readJson(KEYS.favorites, DEFAULT_FAVORITES) })!, readWishDoc);
  const wishlist = doc.data.wishlist;
  const favoriteIds = doc.data.favorites;
  const setWishlist = useCallback((next: (list: Wish[]) => Wish[]) => change((d) => ({ ...d, wishlist: next(d.wishlist) })), [change]);
  const setFavorites = useCallback((next: (ids: string[]) => string[]) => change((d) => ({ ...d, favorites: next(d.favorites) })), [change]);
  const [state, setState] = useState<WatchState>({ items: [], sales: [], meta: false });
  const [watchError, setWatchError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>(() => readJson(KEYS.seen, []));
  const first = useRef(true);

  // слежка за ценой: при каждом изменении вишлиста отправляем весь список (и пустой — чтобы сервер забыл удалённое),
  // в ответ сервер отдаёт последние проверки цен
  useEffect(() => {
    const live = wishlist.filter((w) => w.storeId && (LIVE_STORE_IDS as readonly string[]).includes(w.storeId));
    const send = () =>
      putWatch(live.map((w) => ({ id: w.id, name: w.name, storeId: w.storeId!, ref: w.ref, url: w.url, price: w.price, currency: w.currency, country, targetPrice: w.targetPrice ?? null })))
        .then((next) => {
          setState(next);
          setWatchError(null);
        })
        .catch((e) => setWatchError(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          first.current = false;
        });
    const t = setTimeout(send, first.current ? 0 : 600);
    return () => clearTimeout(t);
  }, [wishlist, country]);

  // пока приложение открыто — подтягиваем свежие проверки раз в 10 минут
  useEffect(() => {
    const id = setInterval(() => getWatch().then(setState).catch(() => undefined), 10 * 60_000);
    return () => clearInterval(id);
  }, []);

  const freshDrops = useMemo(() => {
    const keys = new Set(seen);
    const fresh = state.items.filter((w) => {
      const k = dropKey(w);
      return k && !keys.has(k);
    });
    return wishlist.filter((w) => fresh.some((f) => f.id === w.id));
  }, [state.items, seen, wishlist]);

  // о новых скидках — уведомление на телефоне (если разрешено); на вебе только баннер
  const notified = useRef(new Set<string>());
  useEffect(() => {
    const names = freshDrops.filter((w) => !notified.current.has(w.id)).map((w) => w.name);
    freshDrops.forEach((w) => notified.current.add(w.id));
    notifyDrops(names).catch(() => undefined);
  }, [freshDrops]);

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
            : [{ id: it.id, name: it.name, meta: it.meta, image: it.image, storeId: it.shop?.storeId ?? null, ref: it.shop?.ref ?? null, url: it.shop?.url ?? null, price: it.shop?.price ?? null, currency: it.shop?.currency ?? null, targetPrice: null, addedAt: new Date().toISOString() }, ...list]
        ),
      removeWish: (id) => setWishlist((list) => list.filter((w) => w.id !== id)),
      watch: (id) => state.items.find((w) => w.id === id),
      watchError,
      serverHasKey: state.meta,
      sale: (storeId) => state.sales.find((s) => s.storeId === storeId && s.country === country),
      setTarget: (id, price) => {
        setWishlist((list) => list.map((w) => (w.id === id ? { ...w, targetPrice: price } : w)));
        if (price !== null) askNotifications().catch(() => undefined);
      },
      freshDrops,
      dismissDrops: () => {
        const keys = state.items.map(dropKey).filter((k): k is string => !!k);
        setSeen(keys);
        writeSetting(KEYS.seen, JSON.stringify(keys));
      },
    }),
    [country, favoriteIds, wishlist, state, watchError, freshDrops, setFavorites, setWishlist]
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
