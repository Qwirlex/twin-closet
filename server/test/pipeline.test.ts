import type { Job, Upload } from '@twin/shared'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { remoteImage } from '../src/pipeline/common'
import { shortTitle, storeByBrand } from '../src/pipeline/item'
import { Store } from '../src/store'
import { PriceWatch } from '../src/watch'
import { fakeMeta, pngBase64, SAM_H, SAM_W, samText, type FakeOptions } from './fake-meta'

const dir = mkdtempSync(join(tmpdir(), 'twin-pipe-'))

export function setup(opts: FakeOptions | null, fetchImpl?: typeof fetch) {
  const store = new Store(mkdtempSync(join(dir, 'data-')))
  const fake = opts ? fakeMeta(opts) : { meta: new MetaApi(''), calls: [] }
  const jobs = new Jobs(store, fake.meta, join(dir, 'no-samples'), () => {}, fetchImpl)
  const app = createApp({ store, jobs, meta: fake.meta, watch: new PriceWatch(store, fake.meta, PriceWatch.jobSearch(jobs, fake.meta)), log: () => {} })
  return { store, app, jobs, calls: fake.calls }
}

async function photo(name: string): Promise<string> {
  const path = join(dir, name)
  writeFileSync(path, Buffer.from(await pngBase64(SAM_W, SAM_H, [30, 60, 140]), 'base64'))
  return path
}

async function upload(app: ReturnType<typeof setup>['app'], path: string): Promise<Upload> {
  const form = new FormData()
  form.append('file', new File([readFileSync(path)], 'shot.png', { type: 'image/png' }))
  return (await app.request('/uploads', { method: 'POST', body: form })).json()
}

async function run(jobs: Jobs, app: ReturnType<typeof setup>['app'], body: object): Promise<Job> {
  const res = await app.request('/jobs', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  expect(res.status).toBe(201)
  return jobs.wait(((await res.json()) as Job).id, 30_000)
}

const READING = { brand: 'ZARA', product_name: 'Wide-leg jeans with pleats', kind: 'bottom', color: 'light blue', ref: '1234/567/800', price: 39.95, old_price: null, currency: 'EUR', size: 'M', composition: '100% cotton', on_sale: false, is_screenshot: true }

describe('a new piece from a screenshot', () => {
  it('reads it, cuts it out, finds it in the store and in the closet', async () => {
    const { app, jobs, store, calls } = setup({
      spark: {
        tag_reading: READING,
        store_product: { products: [{ title: 'Wide-leg jeans', url: 'https://www.zara.com/ie/en/wide-leg-jeans-p01234567.html', price: 35.95, currency: 'EUR', in_stock: true }] },
        similar_owned: { verdict: 'similar', similar: [{ id: 'blackjeans', reason: 'Same cut, yours are black' }, { id: 'ghost', reason: 'not in the closet' }] }
      },
      sam: (prompt) => (prompt === 'wide-leg jeans with pleats' ? samText([0, 1]) : '')
    })
    const u = await upload(app, await photo('a.png'))
    const job = await run(jobs, app, { kind: 'import_item', uploadId: u.id, country: 'IE', closet: [{ id: 'blackjeans', title: 'Black jeans', kind: 'bottom', color: 'black' }, { id: 5 }] })
    expect(job.status).toBe('done')
    expect(job.steps.map((s) => s.key)).toEqual(['prepare', 'read', 'cutout', 'online', 'similar'])
    const item = job.result.item!
    expect(item).toMatchObject({ kind: 'bottom', title: 'Wide-leg jeans with pleats', color: 'light blue', material: '100% cotton', source: 'screenshot' })
    expect(item.shop).toMatchObject({ brand: 'Zara', ref: '1234/567/800', sizes: 'M', url: 'https://www.zara.com/ie/en/wide-leg-jeans-p01234567.html', price: '35.95 EUR' })
    expect(job.result.similar).toEqual([{ garmentId: 'blackjeans', reason: 'Same cut, yours are black' }])

    // вырезка: PNG с прозрачностью — непрозрачно только внутри маски SAM (самый уверенный и крупный объект)
    expect(item.cutoutUrl).toBe(`/files/${job.id}-cut.png`)
    const { data, info } = await sharp(store.path(`${job.id}-cut.png`)).raw().toBuffer({ resolveWithObject: true })
    expect(info.channels).toBe(4)
    let opaque = 0
    let clear = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) opaque++
      else clear++
    }
    expect(opaque).toBeGreaterThan(1000)
    expect(clear).toBeGreaterThan(0)

    // поиск в магазине — по REF и стране, с веб-поиском; шкаф ушёл в Spark текстом
    const search = calls.find((c) => c.task === 'store_product')!
    expect(JSON.stringify(search.body)).toContain('1234/567/800')
    expect((search.body.tools as { user_location: { country: string } }[])[0].user_location.country).toBe('IE')
    expect(JSON.stringify(calls.find((c) => c.task === 'similar_owned')!.body)).toContain('id blackjeans: Black jeans')
  })

  it('keeps the photo when SAM finds nothing, skips the store search for other brands', async () => {
    const { app, jobs, calls } = setup({ spark: { tag_reading: { ...READING, brand: 'Uniqlo', ref: null }, similar_owned: { verdict: 'new', similar: [] } }, sam: () => '' })
    const u = await upload(app, await photo('b.png'))
    const job = await run(jobs, app, { kind: 'import_item', uploadId: u.id })
    expect(job.status).toBe('done')
    expect(job.result.item!.cutoutUrl).toBe(`/files/${job.id}-cut.jpg`)
    expect(job.result.notes![0]).toMatch(/did not find/)
    expect(calls.some((c) => c.task === 'store_product')).toBe(false)
    // без шкафа сравнивать не с чем — модель не вызывается
    expect(calls.some((c) => c.task === 'similar_owned')).toBe(false)
    expect(job.result.similar).toEqual([])
  })

  it('without the key it stops at the first model step, as before', async () => {
    const { app, jobs } = setup(null)
    const u = await upload(app, await photo('c.png'))
    const job = await run(jobs, app, { kind: 'import_item', uploadId: u.id })
    expect(job.errorCode).toBe('no_key')
    expect(job.steps.find((s) => s.status === 'failed')!.key).toBe('read')
  })

  it('names and stores: short titles, live store by brand', () => {
    expect(storeByBrand('ZARA')).toBe('zara')
    expect(storeByBrand('Pull&Bear')).toBe('pull-and-bear')
    expect(storeByBrand('Mango')).toBeNull()
    expect(shortTitle({ ...READING, product_name: 'ZARA ZW Collection wide-leg jeans with pleats' } as never)).toBe('collection wide-leg jeans with')
    expect(shortTitle({ ...READING, product_name: null } as never)).toBe('light blue trousers')
  })
})

describe('photos only from our own places', () => {
  it('refuses links to other sites', async () => {
    const store = new Store(mkdtempSync(join(dir, 'own-')))
    await expect(remoteImage('https://evil.example.com/me.jpg', store)).rejects.toThrow(/Only photos/)
    await expect(remoteImage('https://twin-closet.vercel.app/api/x', store)).rejects.toThrow(/Only photos/)
    await expect(remoteImage('/files/../../etc/passwd', store)).rejects.toThrow(/Only photos/)
    let asked = ''
    const fetchImpl = (async (url: string) => {
      asked = url
      return new Response(Buffer.from('img'))
    }) as unknown as typeof fetch
    expect((await remoteImage('https://twin-closet.vercel.app/assets/demo/me.webp', store, fetchImpl)).toString()).toBe('img')
    expect(asked).toBe('https://twin-closet.vercel.app/assets/demo/me.webp')
  })
})

describe('closet scan from a video', () => {
  it('Spark boxes → SAM track → best frame cut-outs → tags, duplicates merged', async () => {
    const video = join(dir, 'rail.mp4')
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=${SAM_W}x${SAM_H}:rate=30:duration=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
    const { app, jobs, store, calls } = setup({
      spark: {
        closet_garments: { garments: [{ label: 'black hoodie', kind: 'top', frame: 1, box: { x_min: 600, y_min: 650, x_max: 860, y_max: 780 } }, { label: 'grey tee', kind: 'top', frame: 5, box: { x_min: 450, y_min: 650, x_max: 640, y_max: 780 } }] },
        // подписи идут параллельно — ответ одинаковый для обеих вырезок (одна вещь, снятая дважды)
        garment_tags: { title: 'black hoodie', kind: 'top', color: 'black', material: 'cotton', fit: 'oversize', pattern: null, season: 'all' },
        garment_duplicates: { groups: [['1', '2']] }
      },
      sam: () => samText([1, 2], [7, 21])
    })
    const form = new FormData()
    form.append('file', new File([readFileSync(video)], 'rail.mp4', { type: 'video/mp4' }))
    const u = (await (await app.request('/uploads', { method: 'POST', body: form })).json()) as Upload
    const job = await run(jobs, app, { kind: 'closet_scan', uploadId: u.id })
    expect(job.status).toBe('done')
    // одна вещь, снятая дважды, — одна
    expect(job.result.garments).toHaveLength(1)
    const g = job.result.garments![0]
    expect(g).toMatchObject({ id: `${job.id}-g1`, kind: 'top', title: 'black hoodie', color: 'black', material: 'cotton', source: 'closet' })
    expect(existsSync(store.path(g.cutoutUrl.replace('/files/', '')))).toBe(true)
    expect(existsSync(store.path(g.sourceFrameUrl!.replace('/files/', '')))).toBe(true)
    // видео ушло в Files API, SAM получил рамки с нашими id на кадрах видео ключевых кадров (15 к/с)
    expect(calls.some((c) => c.path === '/files')).toBe(true)
    const sam = calls.find((c) => c.model === 'sam-3.1')!
    const prompt = JSON.stringify(sam.body)
    expect(prompt).toContain('"file_id":"file-')
    // правая и нижняя граница в подсказке не включительно (как у официального сборщика): 275 → 274
    expect(prompt).toContain('<6f>1<|box;x1=192;y1=217;x2=274;y2=260;w=320;h=334|>')
    expect(prompt).toMatch(/<21f>2<\|box/)
  }, 60_000)
})

describe('body scan masks', () => {
  const sam = (prompt: string) => (prompt === 'person' || prompt === 'hand' ? samText([0, 1]) : prompt === 'face' || prompt === 'top' ? samText([0]) : '')

  it('smart scan: four labelled photos → person, protected zone and clothes on every angle', async () => {
    const { app, jobs, store, calls } = setup({ sam })
    const ids = await Promise.all(['f.png', 't.png', 's.png', 'k.png'].map(async (n) => (await upload(app, await photo(n))).id))
    const views = ['front', 'three_quarter', 'side', 'back']
    const job = await run(jobs, app, { kind: 'body_scan', shots: ids.map((uploadId, i) => ({ uploadId, view: views[i] })) })
    expect(job.status).toBe('done')
    expect(job.result.body!.map((b) => b.angle)).toEqual(views)
    const front = job.result.body![0]
    expect(Object.keys(front.masks.garments)).toEqual(['top'])
    for (const url of [front.masks.person, front.masks.protected, front.masks.garments.top!]) expect(existsSync(store.path(url.replace('/files/', '')))).toBe(true)
    // ракурсы подписаны при съёмке — Spark их не выбирает; SAM — по одному понятию на запрос
    expect(calls.some((c) => c.task === 'body_angles')).toBe(false)
    expect(calls.filter((c) => c.model === 'sam-3.1')).toHaveLength(4 * 9)
    // защищённая зона — лицо и кисти (волос в ответе нет): не пустая
    const m = await sharp(store.path(front.masks.protected.replace('/files/', ''))).raw().toBuffer()
    expect(m.some((v) => v > 0)).toBe(true)
  }, 60_000)

  it('video spin: Spark picks the angles and gives advice; nobody in the photo → clear error', async () => {
    const video = join(dir, 'spin.mp4')
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=${SAM_W}x${SAM_H}:rate=30:duration=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
    const form = () => {
      const f = new FormData()
      f.append('file', new File([readFileSync(video)], 'spin.mp4', { type: 'video/mp4' }))
      return f
    }
    const angles = { front: 0, three_quarter: 3, side: null, back: 9, problems: ['More light, please'] }
    const ok = setup({ spark: { body_angles: angles }, sam })
    const u = (await (await ok.app.request('/uploads', { method: 'POST', body: form() })).json()) as Upload
    const job = await run(ok.jobs, ok.app, { kind: 'body_scan', uploadId: u.id })
    expect(job.status).toBe('done')
    expect(job.result.body!.map((b) => [b.angle, b.url])).toEqual([
      ['front', `/files/${job.id}-k0.jpg`],
      ['three_quarter', `/files/${job.id}-k3.jpg`],
      ['back', `/files/${job.id}-k9.jpg`]
    ])
    expect(job.result.problems).toEqual(['More light, please'])

    const empty = setup({ spark: { body_angles: angles }, sam: () => '' })
    const u2 = (await (await empty.app.request('/uploads', { method: 'POST', body: form() })).json()) as Upload
    const failed = await run(empty.jobs, empty.app, { kind: 'body_scan', uploadId: u2.id })
    expect(failed.errorCode).toBe('bad_input')
    expect(failed.error).toMatch(/could not find you/)
  }, 60_000)
})

describe('try-on', () => {
  // человек — оба объекта образца, верх — первый, лицо — второй (защищённая зона не совпадает с одеждой)
  const sam = (prompt: string) => (prompt === 'person' ? samText([0, 1]) : prompt === 'top' ? samText([0]) : prompt === 'face' ? samText([0], [0], [1]) : '')

  it('Muse Image dresses the photo, SAM keeps face and hands real, Spark scores it', async () => {
    const { app, jobs, store, calls } = setup({
      sam,
      image: () => pngBase64(SAM_W, SAM_H, [200, 40, 40]),
      spark: { tryon_check: { same_person: true, pose_unchanged: true, garment_matches: true, seam_visible: false, score: 8, issue: null } }
    })
    const me = await upload(app, await photo('me.png'))
    const piece = await upload(app, await photo('piece.png'))
    const job = await run(jobs, app, { kind: 'try_on', tryOn: { person: me.url, garments: [{ label: 'wide-leg jeans from a store', url: piece.url, fit: 'relaxed in the hips' }], angle: 'front' } })
    expect(job.error).toBeNull()
    expect(job.status).toBe('done')
    expect(job.steps.map((s) => [s.key, s.model])).toEqual([
      ['dress', 'Muse Image'],
      ['protect', 'SAM 3.1'],
      ['check', 'Muse Spark']
    ])
    expect(job.result.render).toEqual({ angle: 'front', url: `/files/${job.id}-render.jpg`, score: 8, issue: null })
    expect(existsSync(store.path(`${job.id}-render.jpg`))).toBe(true)
    // поиск картинок у Muse Image выключен, посадка ушла в промпт
    const image = calls.find((c) => c.model === 'muse-image-1.0')!
    expect(image.body.tools).toEqual([{ type: 'image_generation', enable_image_search: false, enable_web_search: false, enable_shell: false }])
    expect(JSON.stringify(image.body)).toContain('relaxed in the hips')
  }, 60_000)

  it('refuses photos from other sites and a moved pose', async () => {
    const a = setup({ sam, image: () => pngBase64() })
    const me = await upload(a.app, await photo('me2.png'))
    const foreign = await run(a.jobs, a.app, { kind: 'try_on', tryOn: { person: me.url, garments: [{ label: 'jeans', url: 'https://evil.example.com/x.png' }], angle: 'front' } })
    expect(foreign.errorCode).toBe('bad_input')
    expect(foreign.error).toMatch(/Only photos/)
    expect(a.calls.some((c) => c.model === 'muse-image-1.0')).toBe(false)

    // на генерации человека нет совсем — фигура «уехала», рендер не берём
    // первые 9 запросов SAM — оригинал (человек, лицо, волосы, кисти, 5 видов одежды), дальше — генерация
    const b = setup({ sam: (p) => (p === 'person' && b.calls.filter((c) => c.model === 'sam-3.1').length > 9 ? '' : sam(p)), image: () => pngBase64() })
    const me2 = await upload(b.app, await photo('me3.png'))
    const moved = await run(b.jobs, b.app, { kind: 'try_on', tryOn: { person: me2.url, garments: [{ label: 'jeans', url: me2.url }], angle: 'front' } })
    expect(moved.errorCode).toBe('model')
    expect(moved.error).toMatch(/changed your pose/)
    expect(moved.result.render).toBeUndefined()
  }, 60_000)
})

describe('Twin with tools', () => {
  const context = {
    closet: [{ id: 'hoodie', title: 'Black hoodie', kind: 'top', color: 'black' }, { id: 'jeans', title: 'Black jeans', kind: 'bottom', color: 'black' }],
    wishlist: [{ id: 'w1', name: 'Olive bomber', storeId: 'zara', price: 49.95, currency: 'EUR' }],
    style: { styles: [{ id: 'military', weight: 100 }], colors: ['olive'], avoid: [] },
    favorites: ['zara', 'mango'],
    country: 'IE',
    who: 'men'
  }
  const fc = (name: string, args: object, id: string) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) })

  it('calls tools with the app context, searches a live store, returns actions as buttons', async () => {
    const seen: Record<string, unknown>[] = []
    const { app, calls } = setup({
      spark: { store_product: { products: [{ title: 'Utility jacket', url: 'https://www.zara.com/ie/en/utility-jacket-p05555555.html', price: 59.95, currency: 'EUR', in_stock: true }, { title: 'Other', url: 'https://evil.example.com/x', price: 1, currency: 'EUR', in_stock: true }] } },
      twin: (body) => {
        seen.push(body)
        if (!body.previous_response_id) return { output: [fc('get_closet', { kind: null }, 'c1'), fc('get_trends', {}, 'c2'), fc('search_store', { store_id: 'zara', query: 'olive utility jacket' }, 'c3')] }
        if (seen.length === 2) return { output: [fc('add_to_wishlist', { url: 'https://www.zara.com/ie/en/utility-jacket-p05555555.html', title: 'Utility jacket', price: 59.95, currency: 'EUR' }, 'c4'), fc('start_try_on', { item_ids: ['hoodie', 'jeans', 'ghost'], title: 'Weekend' }, 'c5'), fc('add_to_wishlist', { url: 'https://evil.example.com/x', title: 'x', price: null, currency: null }, 'c6')] }
        return { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Your black hoodie and jeans with an olive utility jacket from Zara.' }] }] }
      }
    })
    const res = await app.request('/twin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', text: 'Weekend outfit?' }], context }) })
    expect(res.status).toBe(200)
    const reply = (await res.json()) as { text: string; actions: unknown[] }
    expect(reply.text).toMatch(/olive utility jacket/)
    expect(reply.actions).toEqual([
      { type: 'wishlist', url: 'https://www.zara.com/ie/en/utility-jacket-p05555555.html', title: 'Utility jacket', price: 59.95, currency: 'EUR' },
      { type: 'try_on', itemIds: ['hoodie', 'jeans'], title: 'Weekend' }
    ])
    // результаты инструментов ушли модели продолжением того же ответа
    const outputs = (seen[1].input as { type: string; call_id: string; output: string }[]).map((o) => [o.call_id, JSON.parse(o.output)])
    expect(outputs[0][1].items.map((i: { id: string }) => i.id)).toEqual(['hoodie', 'jeans'])
    expect(outputs[1][1].trends[0].name).toBe('Military jackets')
    expect(outputs[2][1].products.map((p: { url: string }) => p.url)).toEqual(['https://www.zara.com/ie/en/utility-jacket-p05555555.html'])
    expect(seen[1].previous_response_id).toBeTruthy()
    // поиск — с веб-поиском по стране человека
    expect((calls.find((c) => c.task === 'store_product')!.body.tools as { user_location: { country: string } }[])[0].user_location.country).toBe('IE')
    // чужая ссылка в вишлист — отказ модели, а не кнопка
    expect(JSON.parse((seen[2].input as { output: string }[])[2].output).error).toMatch(/live stores/)
  })

  it('without the key: 503 so the app answers with demo replies; broken chat → 400', async () => {
    const { app } = setup(null)
    expect((await app.request('/twin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', text: 'hi' }] }) })).status).toBe(503)
    const live = setup({ twin: () => ({ output: [] }) })
    expect((await live.app.request('/twin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'assistant', text: 'hi' }] }) })).status).toBe(400)
  })
})

describe('outfits', () => {
  it('3 looks in their style with trends; made-up ids dropped, plain basics last', async () => {
    const { app, calls } = setup({
      spark: {
        outfits: {
          looks: [
            { title: 'Plain', item_ids: ['tee', 'jeans', 'sneakers'], note: 'Easy.' },
            { title: 'Weekend', item_ids: ['bomber', 'tee', 'jeans', 'ghost'], note: 'Bomber over a tee.' },
            { title: 'Nothing', item_ids: ['ghost'], note: '' }
          ]
        }
      }
    })
    const pieces = [
      { id: 'bomber', title: 'Olive bomber', kind: 'outerwear', color: 'olive', material: 'nylon', isNew: true },
      { id: 'tee', title: 'White tee', kind: 'top', color: 'white', material: 'cotton' },
      { id: 'jeans', title: 'Blue jeans', kind: 'bottom', color: 'blue', material: 'denim' },
      { id: 'sneakers', title: 'White sneakers', kind: 'shoes', color: 'white', material: 'canvas' }
    ]
    const res = await app.request('/looks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pieces, style: { styles: [{ id: 'military', weight: 100 }], colors: [], avoid: [] }, who: 'men', country: 'IE' }) })
    expect(res.status).toBe(200)
    const { looks } = (await res.json()) as { looks: { title: string; item_ids: string[]; plain: boolean; detail: string | null }[] }
    expect(looks.map((l) => [l.title, l.item_ids, l.plain, l.detail])).toEqual([
      ['Weekend', ['bomber', 'tee', 'jeans'], false, 'Military jackets'],
      ['Plain', ['tee', 'jeans', 'sneakers'], true, null]
    ])
    const brief = JSON.stringify(calls.find((c) => c.task === 'outfits')!.body)
    expect(brief).toContain('Military jackets')
    expect(brief).toContain('id bomber: Olive bomber')
  })
})
