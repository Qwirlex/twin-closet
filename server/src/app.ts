// HTTP API: загрузки, задачи, файлы. Отдельно от запуска сервера — чтобы гонять в тестах через app.request
import { JOB_KINDS, SAMPLES, type JobInput, type JobKind, type LookupQuery, type SampleName, type Upload } from '@twin/shared'
import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import { JobError, type Jobs } from './jobs'
import type { MetaApi } from './meta'
import type { Store } from './store'
import { Limits, limitsFromEnv, type LimitKind } from './limits'
import type { PriceWatch, WatchInput } from './watch'

/** Видео шкафа на 30 секунд с телефона — до ~150 MB; больше не принимаем */
export const MAX_UPLOAD = 300 * 1024 * 1024

const TYPES: Record<string, { kind: Upload['kind']; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: '.jpg' },
  'image/png': { kind: 'image', ext: '.png' },
  'image/webp': { kind: 'image', ext: '.webp' },
  'video/mp4': { kind: 'video', ext: '.mp4' },
  'video/quicktime': { kind: 'video', ext: '.mov' },
  'video/webm': { kind: 'video', ext: '.webm' }
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }

/** Адрес клиента: за туннелем или прокси — из x-forwarded-for */
function clientIp(c: Context): string {
  const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (fwd) return fwd
  try {
    return getConnInfo(c).remote.address ?? 'local'
  } catch {
    return 'local'
  }
}

export function createApp({ store, jobs, meta, watch, limits = new Limits(limitsFromEnv()) }: { store: Store; jobs: Jobs; meta: MetaApi; watch: PriceWatch; limits?: Limits }): Hono {
  const app = new Hono()
  app.use('*', cors())

  const limited = (c: Context, kind: LimitKind) => {
    const r = limits.check(clientIp(c), kind)
    return r.ok ? null : c.json({ error: r.message, code: 'limit' }, 429, { 'retry-after': String(r.retryAfter) })
  }

  app.get('/health', (c) => c.json({ ok: true, meta: meta.configured }))

  app.post('/uploads', async (c) => {
    const over = limited(c, 'upload')
    if (over) return over
    const size = Number(c.req.header('content-length') ?? 0)
    if (size > MAX_UPLOAD) return c.json({ error: 'The file is larger than 300 MB.' }, 413)
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return c.json({ error: 'Send the file in the "file" field.' }, 400)
    // браузер иногда шлёт пустой тип — тогда смотрим на расширение
    const type = TYPES[file.type] ?? Object.values(TYPES).find((t) => t.ext === extname(file.name).toLowerCase())
    if (!type) return c.json({ error: 'Add a photo (JPEG, PNG, WebP) or a video (MP4, MOV, WebM).' }, 415)
    const id = store.id()
    const name = `${id}${type.ext}`
    writeFileSync(store.path(name), Buffer.from(await file.arrayBuffer()))
    limits.record(clientIp(c), 'upload')
    const upload = store.addUpload({ id, kind: type.kind, name: file.name || name, mime: file.type || MIME[type.ext], size: file.size, url: `/files/${name}`, createdAt: new Date().toISOString() })
    return c.json(upload, 201)
  })

  app.post('/jobs', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { kind?: string; uploadId?: string; sample?: string; lookup?: LookupQuery } | null
    if (!body || !JOB_KINDS.includes(body.kind as JobKind)) return c.json({ error: `kind: ${JOB_KINDS.join(' | ')}` }, 400)
    let input: JobInput
    if (body.lookup && typeof body.lookup.storeId === 'string') input = { lookup: { storeId: body.lookup.storeId, ref: body.lookup.ref, query: body.lookup.query, country: String(body.lookup.country ?? 'IE') } }
    else if (body.uploadId) input = { uploadId: body.uploadId }
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

  app.get('/watch', (c) => c.json({ items: watch.list(), sales: watch.sales(), meta: meta.configured }))

  app.get('/watch/:id/history', (c) => c.json({ points: watch.history(c.req.param('id')) }))

  app.put('/watch', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { items?: WatchInput[] } | null
    if (!Array.isArray(body?.items)) return c.json({ error: 'Send { items: [...] }' }, 400)
    const clean = body.items
      .filter((i) => i && typeof i.id === 'string' && typeof i.storeId === 'string')
      .map((i) => ({ id: i.id, name: String(i.name ?? ''), storeId: i.storeId, ref: i.ref ?? null, url: i.url ?? null, price: typeof i.price === 'number' ? i.price : null, currency: i.currency ?? null, country: String(i.country ?? 'IE'), targetPrice: typeof i.targetPrice === 'number' ? i.targetPrice : null }))
    return c.json({ items: watch.put(clean), sales: watch.sales(), meta: meta.configured })
  })

  app.get('/files/:name', (c) => {
    let path: string
    try {
      path = store.path(c.req.param('name'))
    } catch {
      return c.json({ error: 'Bad file name' }, 400)
    }
    if (!existsSync(path)) return c.json({ error: 'No such file' }, 404)
    return c.body(readFileSync(path), 200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'private, max-age=86400' })
  })

  return app
}
