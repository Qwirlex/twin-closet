// Подставной Meta Model API для тестов конвейера (docs/spec-models.md, «Проверка»): отвечает по модели и по имени задачи Spark.
// SAM — настоящий ответ SAM 3.1 из README @meta-sam/parser (кадр 320×334, два объекта), с нашими id и номером кадра
import sharp from 'sharp'
import { MetaApi, MODELS } from '../src/meta'

const SAM_SAMPLE: [string, string][] = [
  ['<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>', "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>"],
  ['<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|>', '<|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>']
]
/** Кадр, на котором записан образец SAM */
export const SAM_W = 320
export const SAM_H = 334

/**
 * Ответ SAM: объекты с нашими id (не больше двух — столько в образце) на указанных кадрах видео.
 * geometry — какие объекты образца взять (по умолчанию по порядку: первый id — первый объект)
 */
export function samText(ids: number[] = [0, 1], frames: number[] = [0], geometry: number[] = [0, 1]): string {
  return frames.map((f) => `<${f}f>` + ids.slice(0, 2).map((id, i) => `${id}${SAM_SAMPLE[geometry[i]][0]}${SAM_SAMPLE[geometry[i]][1]}`).join(',')).join('\n') + '\n'
}

export async function pngBase64(width = SAM_W, height = SAM_H, rgb: [number, number, number] = [120, 90, 60]): Promise<string> {
  return (await sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer()).toString('base64')
}

export interface FakeOptions {
  /** ответ Muse Spark по имени задачи (text.format.name): JSON или функция от тела запроса */
  spark?: Record<string, unknown | ((body: Record<string, unknown>) => unknown)>
  /** Twin с инструментами: весь объект ответа Responses по телу запроса */
  twin?: (body: Record<string, unknown>) => Record<string, unknown>
  /** текст ответа SAM по подсказке */
  sam?: (prompt: string, body: Record<string, unknown>) => string
  /** base64 картинки Muse Image */
  image?: (body: Record<string, unknown>) => Promise<string> | string
}

export interface FakeCall {
  path: string
  model: string | null
  task: string | null
  body: Record<string, unknown>
}

export function fakeMeta(opts: FakeOptions) {
  const calls: FakeCall[] = []
  let n = 0
  const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } })
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.replace(/^\/v1/, '')
    if (path === '/files') {
      calls.push({ path, model: null, task: null, body: {} })
      return json({ id: `file-${++n}` })
    }
    const body = init?.body && typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    const model = (body.model as string) ?? null
    const task = ((body.text as { format?: { name?: string } } | undefined)?.format?.name as string) ?? null
    calls.push({ path, model, task, body })
    const id = `resp-${++n}`
    if (model === MODELS.sam) {
      const content = ((body.input as { content: { type: string; text?: string }[] }[])[0].content.find((c) => c.type === 'input_text')?.text as string) ?? ''
      return json({ id, output: [], output_text: opts.sam ? opts.sam(content, body) : '' })
    }
    if (model === MODELS.image) {
      const b64 = opts.image ? await opts.image(body) : await pngBase64()
      return json({ id, output: [{ type: 'image_generation_call', result: b64 }] })
    }
    if (model === MODELS.spark && task && opts.spark && task in opts.spark) {
      const r = opts.spark[task]
      const value = typeof r === 'function' ? (r as (b: Record<string, unknown>) => unknown)(body) : r
      return json({ id, output: [], output_text: JSON.stringify(value) })
    }
    // Twin — только запросы с инструментами-функциями (фоновые задачи Spark сюда не попадают)
    const functions = Array.isArray(body.tools) && (body.tools as { type: string }[]).some((t) => t.type === 'function')
    if (model === MODELS.spark && functions && opts.twin) return json({ id, ...opts.twin(body) })
    return new Response(JSON.stringify({ error: `fake: no answer for ${model} ${task}` }), { status: 400 })
  }) as unknown as typeof fetch
  return { meta: new MetaApi('test-key', fetchImpl, async () => undefined), calls }
}
