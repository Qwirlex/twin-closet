import type { Job } from '@twin/shared'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Jobs } from '../src/jobs'
import { MetaApi, MetaError, outputText } from '../src/meta'
import { nextAngleRequest, tryOnRequest } from '../src/models/image'
import { objectPrompt, parseSam, samRequest, conceptPrompt } from '../src/models/sam'
import * as spark from '../src/models/spark'
import { TWIN_TOOLS, twinRequest } from '../src/models/twin'
import { Store } from '../src/store'
import { PriceWatch } from '../src/watch'

/** Строгая JSON-схема: у каждого объекта все поля обязательны и лишних нет (иначе strict json_schema отклонит) */
function assertStrict(schema: unknown, path = '$'): void {
  const s = schema as { type?: unknown; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: unknown; items?: unknown }
  if (s.type === 'object' || (Array.isArray(s.type) && s.type.includes('object'))) {
    expect(s.additionalProperties, `${path} additionalProperties`).toBe(false)
    expect([...(s.required ?? [])].sort(), `${path} required`).toEqual(Object.keys(s.properties ?? {}).sort())
    for (const [k, v] of Object.entries(s.properties ?? {})) assertStrict(v, `${path}.${k}`)
  }
  if (s.items) assertStrict(s.items, `${path}[]`)
}

const TASKS: spark.Task<unknown>[] = [spark.detectGarments, spark.tagGarment, spark.dedupeGarments, spark.pickAngles, spark.readTag, spark.findSimilar, spark.buildLooks, spark.checkTryOn, spark.findProduct({ name: 'Zara', domain: 'zara.com' }), spark.storeSale({ name: 'Zara', domain: 'zara.com' })]

/** Подставной Meta API: отвечает по очереди заготовками и запоминает запросы */
function fakeMeta(replies: (Response | (() => Response))[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {} })
    const r = replies.shift()
    if (!r) throw new Error('no more fake replies')
    return typeof r === 'function' ? r() : r
  }) as unknown as typeof fetch
  const sleeps: number[] = []
  return { meta: new MetaApi('test-key', fetchImpl, async (ms) => void sleeps.push(ms)), calls, sleeps }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })
const sparkReply = (data: unknown, citations: string[] = []) =>
  json({ id: 'resp_1', output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data), annotations: citations.map((url) => ({ type: 'url_citation', url, title: 't' })) }] }] })

describe('Muse Spark tasks', () => {
  it('every schema is strict and every request asks for JSON with room to reason', () => {
    for (const task of TASKS) {
      assertStrict(task.schema, task.name)
      const body = spark.requestBody(task, [spark.text('hi')])
      expect(body.model).toBe('muse-spark-1.3')
      expect(body.max_output_tokens).toBeGreaterThanOrEqual(4000)
      expect(body.text).toMatchObject({ format: { type: 'json_schema', name: task.name, strict: true } })
    }
  })

  it('store search uses web search for the person’s country', () => {
    const body = spark.requestBody(spark.findProduct({ name: 'Zara', domain: 'zara.com' }), [spark.text('REF 1234/567/800')], { webSearchCountry: 'IE' })
    expect(body.tools).toEqual([{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'IE' } }])
    expect(body.include).toEqual(['web_search_call.results'])
  })

  it('turns 0–1000 boxes into pixels for SAM', () => {
    expect(spark.boxToPixels({ x_min: 100, y_min: 250, x_max: 600, y_max: 1100 }, 720, 1280)).toEqual({ x1: 72, y1: 320, x2: 432, y2: 1280 })
  })

  it('prepares images as small JPEG data URLs', async () => {
    const sharp = (await import('sharp')).default
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#888' } }).png().toBuffer()
    const part = await spark.imagePart(big)
    expect(part.type).toBe('input_image')
    const url = (part as { image_url: string }).image_url
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
    const meta = await sharp(Buffer.from(url.split(',')[1], 'base64')).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBe(1280)
  })
})

describe('SAM 3.1', () => {
  it('writes box and point prompts with our ids and the frame size', () => {
    expect(objectPrompt([{ id: 1, box: { x1: 10, y1: 20, x2: 110.4, y2: 220 } }, { id: 2, points: [{ x: 5, y: 6 }, { x: 50, y: 60, negative: true }] }], 720, 960)).toBe(
      '<0f>1<|box;x1=10;y1=20;x2=110;y2=220;w=720;h=960|>,2<|point;x=5;y=6;w=720;h=960|>-<|point;x=50;y=60;w=720;h=960|>'
    )
    expect(() => objectPrompt(Array.from({ length: 17 }, (_, i) => ({ id: i, box: { x1: 0, y1: 0, x2: 1, y2: 1 } })), 10, 10)).toThrow(/16/)
    expect(conceptPrompt('  t-shirt, ')).toBe('t-shirt')
  })

  it('asks for one-bit masks with confidence', () => {
    expect(samRequest('jeans', { imageUrl: 'data:x' })).toMatchObject({ model: 'sam-3.1', metadata: { mask_encoding: 'one_bit', include_confidence: 'true' } })
    expect(JSON.stringify(samRequest('jeans', { videoFileId: 'file-1' }))).toContain('"input_video"')
  })

  it('parses frames out of order, keyed and positional boxes, and keeps masks for the decoder', () => {
    const text = ['<3f>1<|box;x1=5;y1=6;x2=50;y2=60;w=720;h=960|>', '<0f>1<|box;10;20;110;220;720;960;0.93|><|mask;x=0;y=0;0.9;data=24,32,~|!8Gg>Q|>,2<|box;30;40;90;100;720;960|>', 'noise'].join('\n')
    const r = parseSam(text)
    expect(r).toHaveLength(3)
    expect(r[0]).toMatchObject({ frame: 3, id: 1, box: { x1: 5, y1: 6, x2: 50, y2: 60, w: 720, h: 960, c: null }, mask: null })
    expect(r[1]).toMatchObject({ frame: 0, id: 1, box: { x1: 10, y2: 220, c: 0.93 } })
    expect(r[1].mask).toContain('data=24,32')
    expect(r[2]).toMatchObject({ frame: 0, id: 2, box: { x1: 30, y1: 40 } })
    expect(parseSam('')).toEqual([])
  })
})

describe('Muse Image and Twin', () => {
  const part = spark.text('img') as never
  it('try-on keeps image and web search off and labels every picture', () => {
    const body = tryOnRequest(part, [{ label: 'wide-leg jeans from a store', image: part }], 'front')
    expect(body.tools).toEqual([{ type: 'image_generation', enable_image_search: false, enable_web_search: false, enable_shell: false }])
    const content = (body.input as { content: { type: string; text?: string }[] }[])[0].content
    expect(content[0].text).toMatch(/Photo of the person/)
    expect(content[2].text).toBe('Garment 1: wide-leg jeans from a store')
    expect(content.at(-1)!.text).toMatch(/Keep exactly the same person/)
    expect(nextAngleRequest('resp_9', part, 'side')).toMatchObject({ previous_response_id: 'resp_9' })
  })

  it('Twin tools are strict and do not clash with web search names', () => {
    for (const t of TWIN_TOOLS) {
      assertStrict(t.parameters, t.name)
      expect(['browser.search', 'browser.open', 'browser.find']).not.toContain(t.name)
    }
    expect(twinRequest([{ role: 'user', content: 'Dinner on Friday?' }], 'resp_2')).toMatchObject({ model: 'muse-spark-1.3', previous_response_id: 'resp_2' })
  })
})

describe('Meta API client', () => {
  it('retries 429 and 503, honouring Retry-After', async () => {
    const { meta, calls, sleeps } = fakeMeta([json({ error: 'slow down' }, 429, { 'retry-after': '2' }), json({ error: 'busy' }, 503), sparkReply({ ok: true })])
    const r = await meta.responses({ model: 'x' })
    expect(JSON.parse(outputText(r))).toEqual({ ok: true })
    expect(calls).toHaveLength(3)
    expect(sleeps[0]).toBe(2000)
    expect(sleeps[1]).toBeGreaterThan(0)
  })

  it('does not retry a bad request', async () => {
    const { meta, calls } = fakeMeta([json({ error: 'bad' }, 400)])
    await expect(meta.responses({})).rejects.toBeInstanceOf(MetaError)
    expect(calls).toHaveLength(1)
  })
})

describe('store search end to end (fake Muse Spark)', () => {
  function setup(replies: Response[]) {
    const fake = fakeMeta(replies)
    const store = new Store(mkdtempSync(join(tmpdir(), 'twin-models-')))
    const jobs = new Jobs(store, fake.meta, join(tmpdir(), 'none'))
    return { ...fake, store, jobs }
  }

  it('keeps only pages of the store and fills a missing link from citations', async () => {
    const { jobs, calls } = setup([
      sparkReply(
        {
          products: [
            { title: 'WIDE-LEG JEANS', url: 'https://www.zara.com/ie/en/wide-leg-jeans-p01234567.html', price: 39.95, currency: 'EUR', in_stock: true },
            { title: 'Zara jeans deal', url: 'https://deals.example.com/zara', price: 9.99, currency: 'EUR', in_stock: null },
            { title: 'WIDE-LEG JEANS (other colour)', url: 'not a url', price: 39.95, currency: 'EUR', in_stock: null }
          ]
        },
        ['https://www.zara.com/ie/en/wide-leg-jeans-p01234568.html', 'https://news.example.com/zara-sale']
      )
    ])
    const job = jobs.start('product_lookup', { lookup: { storeId: 'zara', ref: '1234/567/800', country: 'IE' } })
    const done = (await jobs.wait(job.id)) as Job
    expect(done.status).toBe('done')
    expect(done.result.products?.map((p) => p.url)).toEqual(['https://www.zara.com/ie/en/wide-leg-jeans-p01234567.html', 'https://www.zara.com/ie/en/wide-leg-jeans-p01234568.html'])
    const body = calls[0].body as { input: { content: { text: string }[] }[]; tools: unknown[]; instructions: string }
    expect(body.input[0].content[0].text).toContain('REF): 1234/567/800')
    expect(body.instructions).toContain('zara.com')
  })

  it('the daily sale check asks Muse Spark for the country', async () => {
    const { jobs, meta, calls } = setup([sparkReply({ on_sale: true, source_url: 'https://www.zara.com/ie/', ends: null })])
    const search = PriceWatch.jobSearch(jobs, meta)
    expect(await search.storeSale('zara', 'IE')).toEqual({ onSale: true, source: 'https://www.zara.com/ie/' })
    expect((calls[0].body.tools as { user_location: { country: string } }[])[0].user_location.country).toBe('IE')
  })
})
