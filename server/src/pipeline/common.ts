// Общее для шагов моделей (docs/spec-models.md, «A»): картинки на вход, ответы SAM, маски и вырезки.
// Каждая задача (item, closet, body, tryon) собирается из этих кирпичиков; форматы ответов разбираются только здесь и в models/*
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import sharp from 'sharp'
import { JobError } from '../errors'
import { outputText, type MetaApi } from '../meta'
import { parseSam, samMask, samRequest, type SamObject } from '../models/sam'
import type { Store } from '../store'
import { bbox, mask, type Mask } from '../tryon/raster'

/** Сайт приложения: демо-фото для примерки лежат там (судья пробует вещи на демо-человеке) */
export const APP_ORIGINS = ['https://twin-closet.vercel.app']
const MAX_REMOTE = 8 * 1024 * 1024

/** Путь к своему файлу по ссылке /files/<name> (без «../» и чужих каталогов); нет файла — null */
export function ownFile(store: Store, url: string): string | null {
  const m = url.match(/^\/files\/([A-Za-z0-9_.-]+)$/)
  if (!m || m[1].includes('..')) return null
  const path = store.path(basename(m[1]))
  return existsSync(path) ? path : null
}

/**
 * Картинка по ссылке — только свои: файл этого сервера (/files/…) или ассет сайта приложения.
 * Чужие адреса не скачиваем вовсе: сервер не ходит туда, куда укажет посетитель
 */
export async function remoteImage(url: string, store: Store, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const own = ownFile(store, url)
  if (own) return readFileSync(own)
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new JobError('bad_input', 'Only photos from Twin Closet can be used here.')
  }
  if (!APP_ORIGINS.includes(u.origin) || !u.pathname.startsWith('/assets/')) throw new JobError('bad_input', 'Only photos from Twin Closet can be used here.')
  const res = await fetchImpl(u.toString(), { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new JobError('bad_input', `Could not load a photo (${res.status}).`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_REMOTE) throw new JobError('bad_input', 'A photo is larger than 8 MB.')
  return data
}

/** Один запрос SAM 3.1; 0 совпадений — пустой список, не ошибка */
export async function runSam(meta: MetaApi, prompt: string, media: { imageUrl: string } | { videoFileId: string }): Promise<SamObject[]> {
  const raw = await meta.responses(samRequest(prompt, media)).catch((e: unknown) => {
    throw new JobError('model', `SAM 3.1 failed: ${e instanceof Error ? e.message : e}`)
  })
  return (await parseSam(outputText(raw), 'imageUrl' in media ? 'image' : 'video')).objects
}

const boxArea = (o: SamObject) => (o.box ? Math.max(0, o.box.x2 - o.box.x1) * Math.max(0, o.box.y2 - o.box.y1) : 0)

/** Лучший объект ответа: уверенность × площадь (вещь на скриншоте — самая крупная и чёткая) */
export function bestObject(objects: SamObject[]): SamObject | null {
  return objects.reduce<SamObject | null>((best, o) => (!best || (o.confidence ?? 0.5) * boxArea(o) > (best.confidence ?? 0.5) * boxArea(best) ? o : best), null)
}

/** Маска объекта во весь кадр; ответ без растра — прямоугольник рамки */
export function objectMask(o: SamObject, width: number, height: number): Mask {
  if (o.mask) {
    const bits = samMask(o.mask, width, height)
    const m = mask(width, height)
    for (let i = 0; i < m.data.length; i++) m.data[i] = bits.data[i]
    return m
  }
  const m = mask(width, height)
  if (!o.box) return m
  for (let y = Math.max(0, o.box.y1); y < Math.min(height, o.box.y2); y++) for (let x = Math.max(0, o.box.x1); x < Math.min(width, o.box.x2); x++) m.data[y * width + x] = 1
  return m
}

/** Объединение масок одного размера */
export function unionAll(width: number, height: number, masks: Mask[]): Mask {
  const out = mask(width, height)
  for (const m of masks) for (let i = 0; i < out.data.length; i++) out.data[i] = Math.max(out.data[i], m.data[i])
  return out
}

/**
 * Вырезка вещи: PNG с прозрачностью вне маски, обрезанный по маске с полями 4%.
 * Пустая маска — null (вырезать нечего)
 */
export async function cutout(framePath: string, m: Mask, out: string): Promise<{ width: number; height: number } | null> {
  const box = bbox(m)
  if (!box) return null
  const { data, info } = await sharp(framePath).removeAlpha().resize(m.width, m.height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(m.width * m.height * 4)
  for (let i = 0; i < m.width * m.height; i++) {
    rgba[i * 4] = data[i * info.channels]
    rgba[i * 4 + 1] = data[i * info.channels + 1]
    rgba[i * 4 + 2] = data[i * info.channels + 2]
    rgba[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, m.data[i])) * 255)
  }
  const pad = Math.round(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.04)
  const left = Math.max(0, box.x0 - pad)
  const top = Math.max(0, box.y0 - pad)
  const width = Math.min(m.width, box.x1 + pad + 1) - left
  const height = Math.min(m.height, box.y1 + pad + 1) - top
  await sharp(rgba, { raw: { width: m.width, height: m.height, channels: 4 } }).extract({ left, top, width, height }).png().toFile(out)
  return { width, height }
}

/** Задачи по очереди с ограничением параллельности (скан себя — десятки запросов SAM) */
export async function inBatches<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map((it, j) => fn(it, i + j)))))
  return out
}
