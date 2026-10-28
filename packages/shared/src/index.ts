// Общие типы приложения и сервера

/** Вид вещи: по нему SAM ищет её на видео, а примерка понимает, что заменять */
export const GARMENT_KINDS = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'] as const
export type GarmentKind = (typeof GARMENT_KINDS)[number]

/** Откуда вещь: мой шкаф, скриншот, скан в магазине или ссылка */
export type GarmentSource = 'closet' | 'screenshot' | 'store_scan' | 'link'

export interface Garment {
  id: string
  source: GarmentSource
  kind: GarmentKind
  /** «чёрное худи, хлопок, oversize» — подпись от Muse Spark */
  title: string
  color: string
  material: string | null
  /** вырезка без фона (PNG с прозрачностью) */
  cutoutUrl: string
  /** кадр, из которого вырезана вещь */
  sourceFrameUrl: string | null
  /** для вещей из магазина */
  shop: { brand: string | null; price: string | null; url: string | null; sizes: string | null; ref?: string | null } | null
  createdAt: string
}

/** Ракурс скана себя */
export type Angle = 'front' | 'three_quarter' | 'side' | 'back'

export interface BodyPhoto {
  angle: Angle
  url: string
  /** маски SAM: защищённая зона (лицо, волосы, кисти) и текущая одежда по видам */
  masks: { protected: string; person: string; garments: Partial<Record<GarmentKind, string>> }
}

export interface Look {
  id: string
  garmentIds: string[]
  /** почему эти вещи вместе — от Muse Spark */
  note: string
  renders: Partial<Record<Angle, string>>
}

/** Похожая вещь, которая уже есть в шкафу */
export interface SimilarOwned {
  garmentId: string
  reason: string
}

/** Долгие задачи: скан шкафа, скан себя, примерка */
export const JOB_KINDS = ['closet_scan', 'body_scan', 'import_item', 'try_on', 'product_lookup'] as const
export type JobKind = (typeof JOB_KINDS)[number]
export type JobStatus = 'queued' | 'running' | 'done' | 'failed'

/** Шаги задачи — экран прогресса показывает их списком с галочками */
export interface JobStep {
  key: string
  label: string
  /** какая модель Meta делает шаг (для подписи и README) */
  model: 'SAM 3.1' | 'Muse Spark' | 'Muse Image' | null
  status: 'pending' | 'running' | 'done' | 'failed'
}

/** no_key — на сервере нет ключа Meta: всё до моделей сделано, дальше ждём ключ */
export type JobErrorCode = 'no_key' | 'bad_input' | 'model' | 'internal'

export interface Job {
  id: string
  kind: JobKind
  status: JobStatus
  /** «нашёл 12 вещей…» — показывается на экране прогресса */
  progress: string
  /** 0..1 */
  percent: number
  steps: JobStep[]
  error: string | null
  errorCode: JobErrorCode | null
  /** что уже получилось (даже если задача упала на шаге моделей) */
  result: JobResult
  /** задача по готовому видео — результат кэшируется и переиспользуется */
  sample: SampleName | null
  createdAt: string
  updatedAt: string
}

/** Откуда взять видео или фото для задачи; поиск вещи в магазине — без файла */
export type JobInput = { uploadId: string } | { sample: SampleName } | { lookup: LookupQuery }

/** Найти вещь онлайн в магазине: по артикулу с бирки или по описанию */
export interface LookupQuery {
  storeId: string
  ref?: string
  query?: string
  /** ISO-код страны: цены и наличие — для этой страны */
  country: string
}

export const SAMPLES = ['closet', 'body', 'item'] as const
export type SampleName = (typeof SAMPLES)[number]

export interface MediaInfo {
  kind: 'image' | 'video'
  width: number
  height: number
  /** секунды, для видео */
  duration: number | null
  frames: number | null
}

export interface JobResult {
  media?: MediaInfo
  /** ключевые кадры, которые увидит Muse Spark */
  keyframes?: string[]
  garments?: Garment[]
  body?: BodyPhoto[]
  item?: Garment
  similar?: SimilarOwned[]
  /** что нашёл веб-поиск Muse Spark */
  products?: ProductHit[]
}

export interface Upload {
  id: string
  kind: 'image' | 'video'
  name: string
  mime: string
  size: number
  url: string
  createdAt: string
}

/** Бренд одежды. Список — Name Suggestion Index (OpenStreetMap, BSD-3), сайты вписаны вручную */
export interface StoreBrand {
  id: string
  name: string
  domain: string
  wikidata: string | null
  /** ISO-коды стран; '001' — весь мир */
  countries: string[]
  /** поиск вещей и слежка за ценой уже работают */
  live: boolean
}

/** Вещь, найденная веб-поиском Muse Spark */
export interface ProductHit {
  title: string
  url: string
  price: number | null
  currency: string | null
  snippet: string
}

/** Вещь в вишлисте, которую сервер проверяет на скидку */
export interface WatchItem {
  id: string
  /** устройство, чей это вишлист (у каждого посетителя — свой); сервер не отдаёт чужие */
  owner?: string
  name: string
  storeId: string
  ref: string | null
  url: string | null
  /** цена, когда вещь добавили */
  price: number | null
  currency: string | null
  country: string
  /** «скажи, когда будет дешевле» — своя цель человека */
  targetPrice: number | null
  /** последняя подтверждённая цена */
  lastPrice: number | null
  /** цена ниже, чем при добавлении, — подтверждена двумя проверками */
  onSale: boolean
  /** подтверждённая цена не выше цели */
  hitTarget: boolean
  /** первая проверка нашла цену ниже — ждём повторную, прежде чем показать */
  pendingPrice: number | null
  /** самая низкая цена за 30 дней по истории проверок */
  lowest30: number | null
  /** страница, с которой взята цена */
  source: string | null
  checkedAt: string | null
}

/** Одна проверка цены — из них история и «самая низкая за 30 дней» */
export interface PricePoint {
  itemId: string
  price: number
  currency: string | null
  url: string
  checkedAt: string
}

/** Идёт ли распродажа в магазине в этой стране — один поиск Spark в день */
export interface StoreSale {
  storeId: string
  country: string
  onSale: boolean
  source: string | null
  checkedAt: string
}

/** Магазины, где поиск вещей и слежка за ценой уже работают; остальные — «Coming soon» */
export const LIVE_STORE_IDS = ['zara', 'bershka', 'pull-and-bear'] as const

/** Сайты живых магазинов: цену принимаем только со страниц этих доменов */
export const LIVE_STORE_DOMAINS: Record<(typeof LIVE_STORE_IDS)[number], string> = {
  zara: 'zara.com',
  bershka: 'bershka.com',
  'pull-and-bear': 'pullandbear.com'
}

/**
 * Состояние устройства на сервере: шкаф, примерка и образы, которые человек добавил сам (без демо-аккаунта).
 * Нужно, чтобы телефон, подключённый к компьютеру по QR, и компьютер видели одно и то же.
 * Содержимое — дело приложения; сервер хранит как есть и сравнивает только updatedAt
 */
export interface DeviceState {
  /** миллисекунды; новее — значит заменяет */
  updatedAt: number
  data: Record<string, unknown>
}

/** Предел состояния одного устройства (JSON), байт */
export const MAX_DEVICE_STATE = 256 * 1024
