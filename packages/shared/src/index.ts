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
export type JobKind = 'closet_scan' | 'body_scan' | 'import_item' | 'try_on'
export type JobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface Job {
  id: string
  kind: JobKind
  status: JobStatus
  /** «нашёл 12 вещей…» — показывается на экране прогресса */
  progress: string
  error: string | null
  createdAt: string
}
