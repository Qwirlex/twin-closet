import type { Angle, GarmentKind } from '@twin/shared';
/** Картинка: локальный require (число) или адрес */
export type Pic = number | { uri: string };

// Демо-аккаунт: один человек, его шкаф, две вещи из магазинов и готовые рендеры.
// Фото сгенерированы для макетов (docs/design.md, «Фото»); настоящие придут из сканов, когда будет ключ Meta.

export interface Item {
  id: string;
  name: string;
  meta: string;
  /** null — вещь ещё не разобрана (нет вырезки и подписи) */
  kind: GarmentKind | null;
  image: Pic;
  /** вещь из магазина — откуда добавлена */
  via?: 'Screenshot' | 'Scanned in store' | 'Link';
  shop?: { price: number | null; url: string | null; currency?: string | null; storeId?: string | null; ref?: string | null };
  /** ждёт вырезку и подпись от моделей Meta */
  pending?: boolean;
  /** задача на сервере, которая разбирает вещь */
  jobId?: string;
  /** uploading → working → готово; waiting — сервер ждёт ключ Meta */
  stage?: 'uploading' | 'working' | 'waiting' | 'failed';
  isNew?: boolean;
}

export const ANGLES: { key: Angle; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'three_quarter', label: '3/4' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
];

/** Скан себя: 4 ракурса */
export const ME: Record<Angle, Pic> = {
  front: require('@/assets/demo/me_front.webp'),
  three_quarter: require('@/assets/demo/me_34.webp'),
  side: require('@/assets/demo/me_side.webp'),
  back: require('@/assets/demo/me_back.webp'),
};

export const HERO_LOGIN: Pic = require('@/assets/demo/hero_login.webp');

/** Мой шкаф. На скане себя человек одет в футболку, чёрные джинсы и челси отсюда */
export const CLOSET: Item[] = [
  { id: 'sneakers', name: 'White sneakers', meta: 'Leather · Low', kind: 'shoes', image: require('@/assets/demo/g_sneakers.webp'), isNew: true },
  { id: 'hoodie', name: 'Black hoodie', meta: 'Cotton · Oversize', kind: 'top', image: require('@/assets/demo/g_hoodie.webp') },
  { id: 'tee', name: 'Grey tee', meta: 'Cotton · Regular', kind: 'top', image: require('@/assets/demo/g_tee.webp') },
  { id: 'blackjeans', name: 'Black jeans', meta: 'Denim · Straight', kind: 'bottom', image: require('@/assets/demo/g_blackjeans.webp') },
  { id: 'boots', name: 'Chelsea boots', meta: 'Leather · Black', kind: 'shoes', image: require('@/assets/demo/g_boots.webp') },
];

/** Вещи, которые человек присматривает в магазинах (демо — без цен и ссылок) */
export const SHOP: Item[] = [
  { id: 'widejeans', name: 'Wide-leg jeans', meta: 'Denim · Light wash', kind: 'bottom', image: require('@/assets/demo/g_widejeans.webp'), via: 'Screenshot', shop: { price: null, url: null } },
  { id: 'bomber', name: 'Olive bomber', meta: 'Nylon · Size M', kind: 'outerwear', image: require('@/assets/demo/g_bomber.webp'), via: 'Scanned in store', shop: { price: null, url: null } },
];

export interface DemoLook {
  id: string;
  title: string;
  itemIds: string[];
  /** рендеры примерки по ракурсам; каких нет — рендерятся по запросу */
  renders: Partial<Record<Angle, Pic>>;
  /** почему эти вещи вместе — потом пишет Muse Spark */
  note: string;
}

export const LOOKS: DemoLook[] = [
  {
    id: 'weekend',
    title: 'Weekend',
    itemIds: ['bomber', 'widejeans', 'sneakers'],
    renders: {
      front: require('@/assets/demo/look1_front.webp'),
      three_quarter: require('@/assets/demo/look1_34.webp'),
      side: require('@/assets/demo/look1_side.webp'),
      back: require('@/assets/demo/look1_back.webp'),
    },
    note: 'Both new pieces with your white sneakers.',
  },
  {
    id: 'office',
    title: 'Office',
    itemIds: ['tee', 'widejeans', 'boots'],
    renders: { front: require('@/assets/demo/look2_front.webp') },
    note: 'The wide-leg cut with your grey tee and Chelsea boots.',
  },
  {
    id: 'evening',
    title: 'Evening',
    itemIds: ['bomber', 'blackjeans', 'sneakers'],
    renders: { front: require('@/assets/demo/look3_front.webp') },
    note: 'The bomber over your black jeans.',
  },
];

/** Образ только из своих вещей — то, в чём человек на скане */
export const OWN_LOOKS: DemoLook[] = [
  { id: 'everyday', title: 'Everyday', itemIds: ['tee', 'blackjeans', 'boots'], renders: { front: ME.front, three_quarter: ME.three_quarter, side: ME.side, back: ME.back }, note: 'What you wore for your scan.' },
];

export const KIND_LABEL: Record<GarmentKind, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses',
  outerwear: 'Outer',
  shoes: 'Shoes',
  accessory: 'Accessories',
};
