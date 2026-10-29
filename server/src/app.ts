// HTTP API: загрузки, задачи, файлы. Отдельно от запуска сервера — чтобы гонять в тестах через app.request
import { checkShots, JOB_KINDS, MAX_DEVICE_STATE, SAMPLES, type JobInput, type JobKind, type LookupQuery, type SampleName, type Shot, type Upload } from '@twin/shared'
import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { createReadStream, statSync } from 'node:fs'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { JobError, type Jobs } from './jobs'
import type { MetaApi } from './meta'
import { BadForm, saveFileField, UploadTooLarge } from './multipart'
import { MIME, type Store } from './store'
import { Limits, limitsFromEnv, type LimitKind } from './limits'
import type { PriceWatch, WatchInput } from './watch'

/** Видео шкафа на 30 секунд с телефона — до ~150 MB (4K); больше не принимаем. Пишется на диск потоком, не в память */
export const MAX_UPLOAD = 300 * 1024 * 1024

const TYPES: Record<string, { kind: Upload['kind']; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: '.jpg' },
  'image/png': { kind: 'image', ext: '.png' },
  'image/webp': { kind: 'image', ext: '.webp' },
  'video/mp4': { kind: 'video', ext: '.mp4' },
  'video/quicktime': { kind: 'video', ext: '.mov' },
  'video/webm': { kind: 'video', ext: '.webm' }
}

// браузер иногда шлёт пустой тип — тогда смотрим на расширение
const typeOf = (type: string, filename: string) => TYPES[type] ?? Object.values(TYPES).find((t) => t.ext === extname(filename).toLowerCase())

/**
 * Адрес клиента для лимитов. За хостингом — из заголовка, который ставит сам прокси и подделать нельзя:
 * Render стоит за Cloudflare (CF-Connecting-IP), Fly — Fly-Client-IP. Иначе — первый адрес x-forwarded-for
 */
function clientIp(c: Context): string {
  for (const h of ['cf-connecting-ip', 'true-client-ip', 'fly-client-ip']) {
    const v = c.req.header(h)?.trim()
    if (v) return v
  }
  const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (fwd) return fwd
  try {
    return getConnInfo(c).remote.address ?? 'local'
  } catch {
    return 'local'
  }
}

export function createApp({ store, jobs, meta, watch, limits = new Limits(limitsFromEnv()), log = console.log }: { store: Store; jobs: Jobs; meta: MetaApi; watch: PriceWatch; limits?: Limits; log?: (m: string) => void }): Hono {
  const app = new Hono()
  app.use('*', cors())

  const limited = (c: Context, kind: LimitKind) => {
    const r = limits.check(clientIp(c), kind)
    return r.ok ? null : c.json({ error: r.message, code: 'limit' }, 429, { 'retry-after': String(r.retryAfter) })
  }

  // корень API открывают из любопытства (судьи, ссылка из README) — отвечаем, что это и где проверка
  app.get('/', (c) => c.json({ name: 'Twin Closet API', health: '/health', app: 'https://twin-closet.vercel.app' }))
  app.get('/health', (c) => c.json({ ok: true, meta: meta.configured, storage: store.kind }))

  app.post('/uploads', async (c) => {
    const over = limited(c, 'upload')
    if (over) return over
    const tooLarge = () => c.json({ error: 'The file is larger than 300 MB.' }, 413)
    if (Number(c.req.header('content-length') ?? 0) > MAX_UPLOAD) return tooLarge()
    const noFile = () => c.json({ error: 'Send the file in the "file" field.' }, 400)
    const body = c.req.raw.body
    if (!body) return noFile()
    const id = store.id()
    let type: (typeof TYPES)[string] | undefined
    let file
    try {
      file = await saveFileField(body, c.req.header('content-type') ?? '', 'file', MAX_UPLOAD, (f) => {
        type = typeOf(f.type, f.filename)
        return type ? store.path(`${id}${type.ext}`) : null
      })
    } catch (e) {
      if (e instanceof UploadTooLarge) return tooLarge()
      if (e instanceof BadForm) return noFile()
      throw e
    }
    if (!file) return noFile()
    if (!type || !file.path) return c.json({ error: 'Add a photo (JPEG, PNG, WebP) or a video (MP4, MOV, WebM).' }, 415)
    const name = `${id}${type.ext}`
    limits.record(clientIp(c), 'upload')
    const upload = store.addUpload({ id, kind: type.kind, name: file.filename || name, mime: TYPES[file.type] ? file.type : MIME[type.ext], size: file.size, url: `/files/${name}`, createdAt: new Date().toISOString() })
    // копия в Supabase — в фоне: задача берёт файл с диска, а копия нужна, если сервер перезапустится до неё
    void store.keep([name]).catch((e) => log(`Supabase: загрузка ${name} не сохранилась (${e instanceof Error ? e.message : e})`))
    return c.json(upload, 201)
  })

  app.post('/jobs', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { kind?: string; uploadId?: string; sample?: string; lookup?: LookupQuery; shots?: unknown } | null
    if (!body || !JOB_KINDS.includes(body.kind as JobKind)) return c.json({ error: `kind: ${JOB_KINDS.join(' | ')}` }, 400)
    let input: JobInput
    if (body.lookup && typeof body.lookup.storeId === 'string') input = { lookup: { storeId: body.lookup.storeId, ref: body.lookup.ref, query: body.lookup.query, country: String(body.lookup.country ?? 'IE') } }
    else if (body.shots !== undefined) {
      const bad = checkShots(body.kind as JobKind, body.shots)
      if (bad) return c.json({ error: bad }, 400)
      input = { shots: (body.shots as Shot[]).map((s) => ({ uploadId: s.uploadId, view: s.view })) }
    } else if (body.uploadId) input = { uploadId: body.uploadId }
    else if (SAMPLES.includes(body.sample as SampleName)) input = { sample: body.sample as SampleName }
    else return c.json({ error: 'Send uploadId or sample.' }, 400)
    const over = limited(c, 'job')
    if (over) return over
    try {
      const job = jobs.start(body.kind as JobKind, input)
      // готовое видео из кэша моделям не стоит ничего — в лимит не считаем
      if (job.status !== 'done') limits.record(clientIp(c), 'job')
      return c.json(job, 201)
    } catch (e) {
      if (e instanceof JobError) return c.json({ error: e.message, code: e.code }, e.code === 'bad_input' ? 404 : 500)
      throw e
    }
  })

  app.get('/jobs/:id', (c) => {
    const job = store.job(c.req.param('id'))
    return job ? c.json(job) : c.json({ error: 'No such job' }, 404)
  })

  // вишлист у каждого устройства свой: приложение шлёт случайный id устройства в x-twin-device
  const device = (c: Context) => {
    const d = c.req.header('x-twin-device') ?? ''
    return /^[a-z0-9-]{8,64}$/i.test(d) ? d : null
  }
  const noDevice = (c: Context) => c.json({ error: 'Send x-twin-device: a random id of this device.' }, 400)

  app.get('/watch', (c) => {
    const d = device(c)
    return d ? c.json({ items: watch.list(d), sales: watch.sales(), meta: meta.configured }) : noDevice(c)
  })

  app.get('/watch/:id/history', (c) => {
    const d = device(c)
    return d ? c.json({ points: watch.history(d, c.req.param('id')) }) : noDevice(c)
  })

  app.put('/watch', async (c) => {
    const d = device(c)
    if (!d) return noDevice(c)
    const body = (await c.req.json().catch(() => null)) as { items?: WatchInput[] } | null
    if (!Array.isArray(body?.items)) return c.json({ error: 'Send { items: [...] }' }, 400)
    const clean = body.items
      .filter((i) => i && typeof i.id === 'string' && typeof i.storeId === 'string')
      .map((i) => ({ id: i.id, name: String(i.name ?? ''), storeId: i.storeId, ref: i.ref ?? null, url: i.url ?? null, price: typeof i.price === 'number' ? i.price : null, currency: i.currency ?? null, country: String(i.country ?? 'IE'), targetPrice: typeof i.targetPrice === 'number' ? i.targetPrice : null }))
    return c.json({ items: watch.put(d, clean), sales: watch.sales(), meta: meta.configured })
  })

  // разделы устройства (шкаф, вишлист) — общие для компьютера и телефона, подключённого по QR (тот же x-twin-device).
  // Разделы хранятся отдельно, чтобы запись одного не затирала другой
  const slice = (c: Context) => {
    const d = device(c)
    const name = c.req.param('slice') ?? ''
    return d && /^[a-z]{1,20}$/.test(name) ? `${d}/${name}` : null
  }

  app.get('/state/:slice', (c) => {
    const key = slice(c)
    return key ? c.json(store.device(key) ?? { updatedAt: 0, data: {} }) : noDevice(c)
  })

  app.put('/state/:slice', async (c) => {
    const key = slice(c)
    if (!key) return noDevice(c)
    const raw = await c.req.text()
    if (raw.length > MAX_DEVICE_STATE) return c.json({ error: 'The closet state is too large.' }, 413)
    let body: { updatedAt?: unknown; data?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return c.json({ error: 'Send JSON { updatedAt, data }' }, 400)
    }
    const { updatedAt, data } = body
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || !data || typeof data !== 'object' || Array.isArray(data)) return c.json({ error: 'Send JSON { updatedAt, data }' }, 400)
    // часы телефона могут спешить: время из будущего прижимаем к серверному
    return c.json(store.putDevice(key, { updatedAt: Math.min(updatedAt, Date.now()), data: data as Record<string, unknown> }))
  })

  app.get('/files/:name', async (c) => {
    const name = c.req.param('name')
    let path: string
    try {
      path = store.path(name)
    } catch {
      return c.json({ error: 'Bad file name' }, 400)
    }
    // после перезапуска рабочая папка пустая — файл докачивается из Supabase
    const here = await store.ensure(name).catch((e) => {
      log(`Supabase: файл ${name} не скачался (${e instanceof Error ? e.message : e})`)
      return false
    })
    if (!here) return c.json({ error: 'No such file' }, 404)
    // отдаём потоком: видео целиком в память не читаем
    const stream = Readable.toWeb(createReadStream(path)) as ReadableStream
    return c.body(stream, 200, { 'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream', 'content-length': String(statSync(path).size), 'cache-control': 'private, max-age=86400' })
  })

  return app
}
