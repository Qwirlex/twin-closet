// Скан шкафа (docs/spec-models.md, «C»): ключевые кадры → вещи с рамками (Spark) → трек по видео (SAM, рамки с нашими id) →
// вырезка лучшего кадра каждой вещи → подписи и склейка дублей (Spark)
import { readFileSync } from 'node:fs'
import type { Garment } from '@twin/shared'
import { JobError } from '../errors'
import { frameAt } from '../media'
import { objectPrompt, type SamObject } from '../models/sam'
import { boxToPixels, dedupeGarments, detectGarments, imagePart, runTask, tagGarment, text, type DetectedGarment, type GarmentTags, type Part } from '../models/spark'
import { area } from '../tryon/raster'
import { cutout, inBatches, objectMask, runSam } from './common'
import type { StepContext } from './context'

const KEYFRAMES = 8
/** SAM держит до 16 объектов за запрос — больше вещей делим на группы */
const GROUP = 16

interface Tracked {
  /** наш номер вещи в подсказке SAM (с 1) */
  id: number
  detected: DetectedGarment
  frames: SamObject[]
}

const failed = (model: string) => (e: unknown) => {
  throw new JobError('model', `${model} failed: ${e instanceof Error ? e.message : e}`)
}

/** Секунда ключевого кадра i — так же, как их режет media.keyframes */
const keyframeTime = (i: number, duration: number, count = KEYFRAMES) => duration * ((i + 0.5) / count)

/** Шаг detect: Muse Spark смотрит пронумерованные ключевые кадры и перечисляет вещи с рамками 0–1000 */
export async function detectCloset(ctx: StepContext): Promise<void> {
  const frames = ctx.result.keyframes ?? []
  if (!frames.length) throw new JobError('bad_input', 'No key frames to look at. Film the rail again.')
  const parts: Part[] = []
  for (const [i] of frames.entries()) {
    parts.push(text(`Frame ${i}`))
    parts.push(await imagePart(ctx.store.path(`${ctx.jobId}-k${i}.jpg`)))
  }
  const { data } = await runTask(ctx.meta, detectGarments, parts).catch(failed('Muse Spark'))
  ctx.scratch.detected = data.garments.filter((g) => g.frame >= 0 && g.frame < frames.length).slice(0, 40)
}

/** Шаг track: видео в Files API, рамки в пикселях на кадре видео ключевого кадра, трек SAM через весь проход */
export async function trackCloset(ctx: StepContext): Promise<void> {
  const detected = (ctx.scratch.detected as DetectedGarment[]) ?? []
  const media = ctx.result.media
  if (!detected.length || !media?.duration) {
    ctx.scratch.tracked = []
    return
  }
  const fps = media.frames && media.duration ? media.frames / media.duration : 15
  const video = readFileSync(ctx.store.path(`${ctx.jobId}.mp4`))
  const file = await ctx.meta.uploadFile(new Blob([video], { type: 'video/mp4' }), `${ctx.jobId}.mp4`).catch(failed('Files API'))
  const tracked: Tracked[] = detected.map((d, i) => ({ id: i + 1, detected: d, frames: [] }))
  for (let g = 0; g < tracked.length; g += GROUP) {
    const group = tracked.slice(g, g + GROUP)
    const prompt = objectPrompt(
      group.map((t) => ({ id: t.id, box: boxToPixels(t.detected.box, media.width, media.height), frame: Math.round(keyframeTime(t.detected.frame, media.duration!) * fps) })),
      media.width,
      media.height
    )
    for (const o of await runSam(ctx.meta, prompt, { videoFileId: file.id })) group.find((t) => t.id === o.id)?.frames.push(o)
  }
  ctx.scratch.tracked = tracked
  ctx.scratch.fps = fps
}

/** Кадр, где вещь видна лучше всего: самая большая маска, рамка не касается края кадра */
export function bestFrame(frames: SamObject[], width: number, height: number): SamObject | null {
  const inside = (o: SamObject) => !!o.box && o.box.x1 > 0 && o.box.y1 > 0 && o.box.x2 < width && o.box.y2 < height
  const size = (o: SamObject) => (o.mask ? area(objectMask(o, width, height)) : o.box ? (o.box.x2 - o.box.x1) * (o.box.y2 - o.box.y1) : 0)
  const pool = frames.some(inside) ? frames.filter(inside) : frames
  return pool.reduce<SamObject | null>((best, o) => (!best || size(o) > size(best) ? o : best), null)
}

/** Шаг cutout: лучший кадр каждой вещи из видео → PNG с прозрачностью */
export async function cutCloset(ctx: StepContext): Promise<void> {
  const tracked = (ctx.scratch.tracked as Tracked[]) ?? []
  const media = ctx.result.media!
  const fps = (ctx.scratch.fps as number) ?? 15
  const cuts: { tracked: Tracked; frame: number; cut: string }[] = []
  for (const t of tracked) {
    const best = bestFrame(t.frames, media.width, media.height)
    if (!best) continue
    const framePath = await frameAt(ctx.store.path(`${ctx.jobId}.mp4`), best.frame / fps, ctx.store.path(`${ctx.jobId}-f${best.frame}.jpg`))
    const name = `${ctx.jobId}-g${t.id}.png`
    if (await cutout(framePath, objectMask(best, media.width, media.height), ctx.store.path(name))) cuts.push({ tracked: t, frame: best.frame, cut: name })
  }
  ctx.scratch.cuts = cuts
}

/** Шаг tag: подпись каждой вырезки, потом склейка дублей (одна вещь, снятая дважды, остаётся одной) */
export async function tagCloset(ctx: StepContext): Promise<void> {
  const cuts = (ctx.scratch.cuts as { tracked: Tracked; frame: number; cut: string }[]) ?? []
  const tagged = await inBatches(cuts, 4, async (c) => {
    const { data } = await runTask(ctx.meta, tagGarment, [await imagePart(ctx.store.path(c.cut))]).catch(failed('Muse Spark'))
    return { ...c, tags: data as GarmentTags }
  })
  let keep = tagged
  if (tagged.length > 1) {
    const parts: Part[] = []
    for (const t of tagged) {
      parts.push(text(`Item ${t.tracked.id}: ${t.tags.title}, ${t.tags.color}`))
      parts.push(await imagePart(ctx.store.path(t.cut)))
    }
    const { data } = await runTask(ctx.meta, dedupeGarments, parts).catch(failed('Muse Spark'))
    // из каждой группы — первая вещь; id, которых модель не назвала, остаются как есть
    const drop = new Set(data.groups.flatMap((g) => g.slice(1)))
    keep = tagged.filter((t) => !drop.has(String(t.tracked.id)))
  }
  const now = new Date().toISOString()
  ctx.result.garments = keep.map(
    (t): Garment => ({
      id: `${ctx.jobId}-g${t.tracked.id}`,
      source: 'closet',
      kind: t.tags.kind,
      title: t.tags.title,
      color: t.tags.color,
      material: t.tags.material,
      cutoutUrl: `/files/${t.cut}`,
      sourceFrameUrl: `/files/${ctx.jobId}-f${t.frame}.jpg`,
      shop: null,
      createdAt: now
    })
  )
}
