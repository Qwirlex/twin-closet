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
  shop: { brand: string | null; price: string | null; url: string | null; sizes: string | null } | null
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
export const JOB_KINDS = ['closet_scan', 'body_scan', 'import_item', 'try_on'] as const
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

/** Откуда взять видео или фото для задачи */
export type JobInput = { uploadId: string } | { sample: SampleName }

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
