import type { Angle, BodyMeasurements, GarmentFit, GarmentKind, StyleId } from '@twin/shared';
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
  /** замеры по размерам — для посадки (docs/spec-fit.md); у своих вещей придут из таблицы магазина или по листу A4 */
  fit?: GarmentFit;
  /** «сидит идеально»: новые вещи того же вида сравниваются с ней */
  favorite?: boolean;
  /** что похожее уже есть в шкафу — ответ Muse Spark на разбор новой вещи */
  similar?: { id: string; reason: string }[];
}

/** Параметры демо-человека: судья видит посадку сразу и может поменять цифру в Me */
export const DEMO_BODY: BodyMeasurements = { heightCm: 183, weightKg: 74, chestCm: 98, waistCm: 80, hipsCm: 96, inseamCm: 84, shoeEu: 43 };

/** Таблица размеров джинсов: обхваты вокруг тела, длина по шву */
const WIDE_JEANS: GarmentFit = {
  cut: 'wide',
  stretch: false,
  size: 'W32',
  source: 'demo',
  sizes: [
    { size: 'W30', zones: { waist: 74, hips: 99, thigh: 69, inseam: 86 } },
    { size: 'W31', zones: { waist: 76.5, hips: 101.5, thigh: 70.5, inseam: 86 } },
    { size: 'W32', zones: { waist: 79, hips: 104, thigh: 72, inseam: 86 } },
    { size: 'W33', zones: { waist: 82, hips: 107, thigh: 73.5, inseam: 86 } },
    { size: 'W34', zones: { waist: 84.5, hips: 109.5, thigh: 75, inseam: 86 } },
  ],
};

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
  {
    id: 'blackjeans',
    name: 'Black jeans',
    meta: 'Denim · Straight',
    kind: 'bottom',
    image: require('@/assets/demo/g_blackjeans.webp'),
    favorite: true,
    fit: { cut: 'regular', stretch: false, size: 'W32', source: 'demo', sizes: [{ size: 'W32', zones: { waist: 82, hips: 98, thigh: 60, inseam: 83 } }] },
  },
  { id: 'boots', name: 'Chelsea boots', meta: 'Leather · Black', kind: 'shoes', image: require('@/assets/demo/g_boots.webp') },
];

/** Вещи, которые человек присматривает в магазинах (демо — без цен и ссылок) */
export const SHOP: Item[] = [
  { id: 'widejeans', name: 'Wide-leg jeans', meta: 'Denim · Light wash', kind: 'bottom', image: require('@/assets/demo/g_widejeans.webp'), via: 'Screenshot', shop: { price: null, url: null }, fit: WIDE_JEANS },
  {
    id: 'bomber',
    name: 'Olive bomber',
    meta: 'Nylon · Relaxed',
    kind: 'outerwear',
    image: require('@/assets/demo/g_bomber.webp'),
    via: 'Scanned in store',
    shop: { price: null, url: null },
    fit: {
      cut: 'relaxed',
      stretch: false,
      size: 'M',
      source: 'demo',
      sizes: [
        { size: 'S', zones: { chest: 104 } },
        { size: 'M', zones: { chest: 112 } },
        { size: 'L', zones: { chest: 120 } },
      ],
    },
  },
];

export interface DemoLook {
  id: string;
  title: string;
  itemIds: string[];
  /** рендеры примерки по ракурсам; каких нет — рендерятся по запросу */
  renders: Partial<Record<Angle, Pic>>;
  /** почему эти вещи вместе — потом пишет Muse Spark */
  note: string;
  /** к каким стилям ближе образ — для «в твоём стиле» */
  styles: StyleId[];
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
    styles: ['military', 'skater'],
  },
  {
    id: 'office',
    title: 'Office',
    itemIds: ['tee', 'widejeans', 'boots'],
    renders: { front: require('@/assets/demo/look2_front.webp') },
    note: 'The wide-leg cut with your grey tee and Chelsea boots.',
    styles: ['scandi_minimal', 'nineties_minimal'],
  },
  {
    id: 'evening',
    title: 'Evening',
    itemIds: ['bomber', 'blackjeans', 'sneakers'],
    renders: { front: require('@/assets/demo/look3_front.webp') },
    note: 'The bomber over your black jeans.',
    styles: ['military', 'nineties_minimal'],
  },
];

/** Образ только из своих вещей — то, в чём человек на скане */
export const OWN_LOOKS: DemoLook[] = [
  { id: 'everyday', title: 'Everyday', itemIds: ['tee', 'blackjeans', 'boots'], renders: { front: ME.front, three_quarter: ME.three_quarter, side: ME.side, back: ME.back }, note: 'What you wore for your scan.', styles: ['scandi_minimal', 'normcore'] },
];

export const KIND_LABEL: Record<GarmentKind, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses',
  outerwear: 'Outer',
  shoes: 'Shoes',
  accessory: 'Accessories',
};
