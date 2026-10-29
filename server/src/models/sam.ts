// SAM 3.1: подсказки и разбор ответа (docs/meta-api.md, «SAM 3.1»).
// Текст подсказок собирает и ответ разбирает официальный @meta-sam/parser; здесь — только перевод в наши типы
// и маска размером с кадр для склейки примерки (tryon/raster.ts)
import { buildObjectPrompt, decodeMaskToRaster, parseImageStream, parseVideoStream, recordsOfKind, type SegmentationMaskRecord } from '@meta-sam/parser'
import { MODELS } from '../meta'
import { mask, type Mask } from '../tryon/raster'

/** Подсказка-понятие: одна короткая фраза-существительное на запрос («t-shirt», не списки через запятую) */
export function conceptPrompt(noun: string): string {
  const clean = noun.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Empty SAM concept')
  return clean
}

export interface ObjectPrompt {
  /** наш номер объекта: он вернётся в ответе и держится через кадры видео */
  id: number
  /** рамка в пикселях кадра; правая и нижняя граница — не включительно (как у рамок в ответе) */
  box?: { x1: number; y1: number; x2: number; y2: number }
  /** точки: positive — «это объект», negative — «это не объект» */
  points?: { x: number; y: number; negative?: boolean }[]
  /** кадр видео, на котором стоит подсказка (у вещей шкафа — свой ключевой кадр); по умолчанию общий */
  frame?: number
}

/**
 * Рамки и точки с нашими id, до 16 объектов за запрос. Координаты — пиксели кадра после поворота
 * (иначе SAM отвечает 400); дробные округляем и прижимаем к кадру — официальный сборщик принимает только целые внутри
 */
export function objectPrompt(objects: ObjectPrompt[], width: number, height: number, frame = 0): string {
  if (!objects.length) throw new Error('No objects for SAM')
  if (objects.length > 16) throw new Error('SAM takes at most 16 objects per request — split into groups')
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)))
  return buildObjectPrompt({
    size: { width, height },
    objects: objects.map((o) => ({
      id: o.id,
      prompts: [
        {
          frame: o.frame ?? frame,
          box: o.box && { left: clamp(o.box.x1, width - 1), top: clamp(o.box.y1, height - 1), right: clamp(o.box.x2, width), bottom: clamp(o.box.y2, height) },
          points: o.points?.map((p) => ({ x: clamp(p.x, width - 1), y: clamp(p.y, height - 1), label: p.negative ? ('negative' as const) : ('positive' as const) }))
        }
      ]
    }))
  })
}

/** Тело запроса: картинка (data: URL / URL) или видео (file_id из /files) */
export function samRequest(prompt: string, media: { imageUrl: string } | { videoFileId: string }): Record<string, unknown> {
  return {
    model: MODELS.sam,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }, 'imageUrl' in media ? { type: 'input_image', image_url: media.imageUrl } : { type: 'input_video', file_id: media.videoFileId }]
      }
    ],
    // маски по одному биту и уверенность — ответ в разы меньше
    metadata: { mask_encoding: 'one_bit', include_confidence: 'true' }
  }
}

export interface SamObject {
  /** кадр видео; у картинки — 0 */
  frame: number
  id: number
  /** правая и нижняя граница не включительно */
  box: { x1: number; y1: number; x2: number; y2: number } | null
  confidence: number | null
  /** маска как пришла — в растр кадра переводит samMask */
  mask: SegmentationMaskRecord | null
}

export interface SamResult {
  objects: SamObject[]
  /** предупреждения разбора (битая строка, неизвестный токен) — в лог, не в ошибку */
  warnings: string[]
}

/**
 * Разбор ответа SAM официальным парсером. Ответ у нас не потоковый — отдаём парсеру весь текст одним событием.
 * Кадры могут идти не по порядку и пропускаться: объект ключуем по (кадр, id)
 */
export async function parseSam(text: string, media: 'image' | 'video'): Promise<SamResult> {
  async function* events() {
    yield { type: 'response.output_text.delta', item_id: 'sam', output_index: 0, content_index: 0, delta: text }
    yield { type: 'response.output_text.done', item_id: 'sam', output_index: 0, content_index: 0, text }
    yield { type: 'response.completed' }
  }
  const result = await (media === 'video' ? parseVideoStream(events()) : parseImageStream(events())).finalResult
  const byKey = new Map<string, SamObject>()
  const get = (frame: number, id: number) => {
    const key = `${frame}:${id}`
    let o = byKey.get(key)
    if (!o) byKey.set(key, (o = { frame, id, box: null, confidence: null, mask: null }))
    return o
  }
  for (const b of recordsOfKind(result.records, 'box')) {
    const o = get(b.frame?.frameIndex ?? 0, Number(b.objectId))
    o.box = { x1: b.left, y1: b.top, x2: b.right, y2: b.bottom }
    o.confidence = b.confidence ?? o.confidence
  }
  for (const m of recordsOfKind(result.records, 'mask')) {
    const o = get(m.frame?.frameIndex ?? 0, Number(m.objectId))
    o.mask = m
    o.box ??= { x1: m.bounds.left, y1: m.bounds.top, x2: m.bounds.right, y2: m.bounds.bottom }
    o.confidence = m.confidence ?? o.confidence
  }
  return {
    objects: [...byKey.values()].sort((a, b) => a.frame - b.frame || a.id - b.id),
    warnings: result.diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`)
  }
}

/**
 * Маска объекта во весь кадр (0/1). Растр SAM покрывает только рамку объекта и может быть мельче её —
 * растягиваем по ближайшему пикселю в рамку, остальное — ноль
 */
export function samMask(record: SegmentationMaskRecord, width: number, height: number): Mask {
  const raster = decodeMaskToRaster(record.mask)
  const { width: rw, height: rh } = record.mask
  const { left, top, right, bottom } = record.bounds
  const out = mask(width, height)
  const bw = right - left
  const bh = bottom - top
  if (bw <= 0 || bh <= 0) return out
  for (let y = Math.max(0, top); y < Math.min(height, bottom); y++) {
    const ry = Math.min(rh - 1, Math.floor(((y - top) * rh) / bh))
    for (let x = Math.max(0, left); x < Math.min(width, right); x++) {
      const rx = Math.min(rw - 1, Math.floor(((x - left) * rw) / bw))
      out.data[y * width + x] = raster[ry * rw + rx]
    }
  }
  return out
}
