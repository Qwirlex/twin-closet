// Примерка (docs/spec-models.md, «E»): Muse Image одевает фото человека → SAM размечает оригинал и генерацию →
// склейка: всё вне одежды и защищённая зона (лицо, волосы, кисти) — пиксели оригинала → Muse Spark проверяет результат
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'
import type { TryOnRequest } from '@twin/shared'
import { JobError } from '../errors'
import { generatedImages } from '../meta'
import { tryOnRequest, type GarmentInput } from '../models/image'
import { conceptPrompt } from '../models/sam'
import { checkTryOn, imagePart, runTask, text } from '../models/spark'
import { composeTryOn } from '../tryon/compose'
import { readImg, writeImg, type Mask } from '../tryon/raster'
import { inBatches, objectMask, remoteImage, runSam, unionAll } from './common'
import type { StepContext } from './context'

const PROTECTED = ['face', 'hair', 'hand']
const CLOTHES = ['top', 'pants', 'shoes', 'jacket', 'dress']

const request = (ctx: StepContext): TryOnRequest => (ctx.input as { tryOn: TryOnRequest }).tryOn
const file = (ctx: StepContext, name: string) => ctx.store.path(`${ctx.jobId}-${name}`)

/** Шаг dress: свои фото человека и вещей (только с этого сервера и сайта приложения) → Muse Image, поиск выключен */
export async function dress(ctx: StepContext): Promise<void> {
  const t = request(ctx)
  const person = await sharp(await remoteImage(t.person, ctx.store, ctx.fetchImpl)).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()
  writeFileSync(file(ctx, 'person.jpg'), person)
  const garments: GarmentInput[] = []
  for (const [i, g] of t.garments.entries()) {
    const data = await remoteImage(g.url, ctx.store, ctx.fetchImpl)
    writeFileSync(file(ctx, `garment${i}.png`), await sharp(data).png().toBuffer())
    garments.push({ label: g.label, image: await imagePart(file(ctx, `garment${i}.png`)), fit: g.fit })
  }
  const raw = await ctx.meta.responses(tryOnRequest(await imagePart(file(ctx, 'person.jpg')), garments, t.angle)).catch((e: unknown) => {
    throw new JobError('model', `Muse Image failed: ${e instanceof Error ? e.message : e}`)
  })
  const [image] = generatedImages(raw)
  if (!image) throw new JobError('model', 'Muse Image returned no picture. Try again.')
  writeFileSync(file(ctx, 'gen.png'), image)
  ctx.scratch.responseId = raw.id
}

/** Маски по понятиям на картинке: объединение всех найденных объектов каждого понятия */
async function masksOf(ctx: StepContext, path: string, concepts: string[]): Promise<{ width: number; height: number; masks: Map<string, Mask> }> {
  const { width = 0, height = 0 } = await sharp(path).metadata()
  const image = { imageUrl: ((await imagePart(path)) as { image_url: string }).image_url }
  const found = await inBatches(concepts, 3, async (c) => [c, unionAll(width, height, (await runSam(ctx.meta, conceptPrompt(c), image)).map((o) => objectMask(o, width, height)))] as const)
  return { width, height, masks: new Map(found) }
}

/** Шаг protect: SAM на оригинале и генерации → выравнивание и вклейка; поза уехала — честная ошибка */
export async function protect(ctx: StepContext): Promise<void> {
  const orig = await masksOf(ctx, file(ctx, 'person.jpg'), ['person', ...PROTECTED, ...CLOTHES])
  const gen = await masksOf(ctx, file(ctx, 'gen.png'), ['person', ...CLOTHES])
  const result = composeTryOn({
    original: await readImg(file(ctx, 'person.jpg')),
    generated: await readImg(file(ctx, 'gen.png')),
    personOrig: orig.masks.get('person')!,
    protectedOrig: unionAll(orig.width, orig.height, PROTECTED.map((c) => orig.masks.get(c)!)),
    clothesOrig: unionAll(orig.width, orig.height, CLOTHES.map((c) => orig.masks.get(c)!)),
    personGen: gen.masks.get('person')!,
    clothesGen: unionAll(gen.width, gen.height, CLOTHES.map((c) => gen.masks.get(c)!))
  })
  if (!result.report.accepted) {
    const moved = /^Figure moved/.test(result.report.reason ?? '')
    throw new JobError('model', moved ? `The try-on changed your pose, so it was not used (${result.report.reason}). Try again.` : `The try-on could not be used (${result.report.reason}). Try again.`)
  }
  await writeImg(result.image, file(ctx, 'render.jpg'))
  ctx.result.render = { angle: request(ctx).angle, url: `/files/${ctx.jobId}-render.jpg`, score: null, issue: null }
}

/** Шаг check: тот ли человек, та ли поза, похожа ли вещь, нет ли шва — оценка 0–10 и главная проблема */
export async function checkRender(ctx: StepContext): Promise<void> {
  const parts = [
    text('1) The original photo:'),
    await imagePart(file(ctx, 'person.jpg')),
    text('2) The try-on result:'),
    await imagePart(file(ctx, 'render.jpg')),
    text('3) The garment they wanted to try:'),
    await imagePart(file(ctx, 'garment0.png'))
  ]
  const { data } = await runTask(ctx.meta, checkTryOn, parts).catch((e: unknown) => {
    throw new JobError('model', `Muse Spark could not check the try-on: ${e instanceof Error ? e.message : e}`)
  })
  ctx.result.render = { ...ctx.result.render!, score: data.score, issue: data.issue }
}
