// Скан себя (docs/spec-models.md, «D»): лучшие кадры ракурсов (Spark) → маски SAM на каждом ракурсе —
// человек, лицо, волосы, кисти (защищённая зона: их примерка не трогает) и одежда, которую можно заменить
import sharp from 'sharp'
import type { Angle, BodyPhoto, GarmentKind } from '@twin/shared'
import { JobError } from '../errors'
import { conceptPrompt } from '../models/sam'
import { imagePart, pickAngles, runTask, text, type Part } from '../models/spark'
import { area, writeMask, type Mask } from '../tryon/raster'
import { inBatches, objectMask, runSam, unionAll } from './common'
import type { StepContext } from './context'

const ANGLES: Angle[] = ['front', 'three_quarter', 'side', 'back']
/** Понятия SAM — по одному на запрос (списки через запятую SAM не понимает) */
const PROTECTED = ['face', 'hair', 'hand'] as const
const CLOTHES: [GarmentKind, string][] = [
  ['top', 'top'],
  ['bottom', 'pants'],
  ['shoes', 'shoes'],
  ['outerwear', 'jacket'],
  ['dress', 'dress']
]

interface AnglePhoto {
  angle: Angle
  path: string
  url: string
}

/** Шаг angles: Muse Spark выбирает лучшие кадры для фронта, ¾, бока и спины и советует, что переснять */
export async function pickBodyAngles(ctx: StepContext): Promise<void> {
  const frames = ctx.result.keyframes ?? []
  if (!frames.length) throw new JobError('bad_input', 'No frames to choose from. Film a slow spin again.')
  const path = (i: number) => (frames.length === 1 && frames[0].endsWith(`${ctx.jobId}.jpg`) ? ctx.store.path(`${ctx.jobId}.jpg`) : ctx.store.path(`${ctx.jobId}-k${i}.jpg`))
  const parts: Part[] = []
  for (const [i] of frames.entries()) {
    parts.push(text(`Frame ${i}`))
    parts.push(await imagePart(path(i)))
  }
  const { data } = await runTask(ctx.meta, pickAngles, parts).catch((e: unknown) => {
    throw new JobError('model', `Muse Spark could not pick the angles: ${e instanceof Error ? e.message : e}`)
  })
  const photos: AnglePhoto[] = ANGLES.flatMap((angle) => {
    const i = data[angle]
    return typeof i === 'number' && i >= 0 && i < frames.length ? [{ angle, path: path(i), url: frames[i] }] : []
  })
  if (!photos.length) throw new JobError('bad_input', data.problems[0] ?? 'No frame shows your whole body. Step back so your feet are in the frame.')
  ctx.scratch.angles = photos
  ctx.result.problems = data.problems
}

/** Ракурсы умного скана подписаны при съёмке: снимок i — ${job}-s<i>.jpg */
function shotAngles(ctx: StepContext): AnglePhoto[] {
  return (ctx.result.shots ?? []).flatMap((s, i) => (ANGLES.includes(s.view as Angle) ? [{ angle: s.view as Angle, path: ctx.store.path(`${ctx.jobId}-s${i}.jpg`), url: s.url }] : []))
}

/** Шаг masks: на каждом ракурсе маски SAM по понятиям; защищённая зона = лицо ∪ волосы ∪ кисти */
export async function maskBody(ctx: StepContext): Promise<void> {
  const photos = (ctx.scratch.angles as AnglePhoto[] | undefined) ?? shotAngles(ctx)
  if (!photos.length) throw new JobError('bad_input', 'No body photos to mask.')
  const body: BodyPhoto[] = []
  for (const p of photos) {
    const { width = 0, height = 0 } = await sharp(p.path).metadata()
    const image = { imageUrl: ((await imagePart(p.path)) as { image_url: string }).image_url }
    const concepts = ['person', ...PROTECTED, ...CLOTHES.map(([, c]) => c)]
    const found = await inBatches(concepts, 3, async (c) => [c, (await runSam(ctx.meta, conceptPrompt(c), image)).map((o) => objectMask(o, width, height))] as const)
    const masks = new Map(found.map(([c, ms]) => [c, unionAll(width, height, ms)]))
    const save = async (name: string, m: Mask) => {
      await writeMask(m, ctx.store.path(`${ctx.jobId}-${p.angle}-${name}.png`))
      return `/files/${ctx.jobId}-${p.angle}-${name}.png`
    }
    const person = masks.get('person')!
    if (!area(person)) throw new JobError('bad_input', `SAM 3.1 could not find you in the ${p.angle.replace('_', ' ')} photo. Stand in the middle of the frame, whole body in view.`)
    const garments: BodyPhoto['masks']['garments'] = {}
    for (const [kind, c] of CLOTHES) if (area(masks.get(c)!)) garments[kind] = await save(kind, masks.get(c)!)
    body.push({
      angle: p.angle,
      url: p.url,
      masks: { person: await save('person', person), protected: await save('protected', unionAll(width, height, PROTECTED.map((c) => masks.get(c)!))), garments }
    })
  }
  ctx.result.body = body
}
