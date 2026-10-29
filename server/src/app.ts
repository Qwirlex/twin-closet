// HTTP API: загрузки, задачи, файлы. Отдельно от запуска сервера — чтобы гонять в тестах через app.request
import { checkShots, cleanStyle, GARMENT_KINDS, JOB_KINDS, type Angle, type ClosetRef, type TryOnRequest, MAX_DEVICE_STATE, SAMPLES, type JobInput, type JobKind, type LookupQuery, type SampleName, type Shot, type Upload } from '@twin/shared'
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
import { trendCountry, Trends } from './trends'
import { buildOutfits, type LookPiece } from './pipeline/looks'
import { twinTurn, type TwinContext } from './pipeline/twin'
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

export function createApp({ store, jobs, meta, watch, limits = new Limits(limitsFromEnv()), log = console.log, trends = new Trends(store, meta.configured ? Trends.spark(meta) : null, log) }: { store: Store; jobs: Jobs; meta: MetaApi; watch: PriceWatch; limits?: Limits; log?: (m: string) => void; trends?: Trends }): Hono {
  const app = new Hono()
  app.use('*', cors())

  const limited = (c: Context, kind: LimitKind) => {
    const r = limits.check(clientIp(c), kind)
    return r.ok ? null : c.json({ error: r.message, code: 'limit' }, 429, { 'retry-after': String(r.retryAfter) })
  }

  // корень API открывают из любопытства (судьи, ссылка из README) — отвечаем, что это и где проверка
  app.get('/', (c) => c.json({ name: 'Twin Closet API', health: '/health', app: 'https://twin-closet.vercel.app' }))
  app.get('/health', (c) => c.json({ ok: true, meta: meta.configured, storage: store.kind }))

  // тренды сезона по стране: с ключом — свежая выжимка Muse Spark раз в неделю, без ключа — curated
  app.get('/trends', (c) => c.json(trends.get(trendCountry(c.req.query('country')))))

  // Twin: чат с Muse Spark и инструментами; без ключа — честный ответ, приложение тогда отвечает заготовками
  app.post('/twin', async (c) => {
    if (!meta.configured) return c.json({ error: 'Twin answers once the server has the Meta key.', code: 'no_key' }, 503)
    const body = (await c.req.json().catch(() => null)) as { messages?: unknown; context?: unknown } | null
    const messages = cleanMessages(body?.messages)
    if (!messages.length || messages.at(-1)!.role !== 'user') return c.json({ error: 'Send the chat with the last message from the person.' }, 400)
    const ctx = cleanTwinContext(body?.context)
    const over = limited(c, 'job')
    if (over) return over
    limits.record(clientIp(c), 'job')
    try {
      return c.json(await twinTurn(meta, messages, ctx, trends.get(ctx.country)))
    } catch (e) {
      log(`twin: ${e instanceof Error ? e.message : e}`)
      return c.json({ error: 'Twin could not answer right now. Try again.' }, 502)
    }
  })

  // образы из новых вещей и шкафа в стиле человека
  app.post('/looks', async (c) => {
    if (!meta.configured) return c.json({ error: 'Outfits are built once the server has the Meta key.', code: 'no_key' }, 503)
    const body = (await c.req.json().catch(() => null)) as { pieces?: unknown; style?: unknown; who?: unknown; country?: unknown } | null
    const pieces = cleanPieces(body?.pieces)
    if (!pieces.some((p) => p.isNew)) return c.json({ error: 'Send at least one new piece.' }, 400)
    const over = limited(c, 'job')
    if (over) return over
    limits.record(clientIp(c), 'job')
    try {
      return c.json({ looks: await buildOutfits(meta, pieces, cleanStyle(body?.style), whoOf(body?.who), trends.get(trendCountry(typeof body?.country === 'string' ? body.country : undefined))) })
    } catch (e) {
      if (e instanceof JobError) return c.json({ error: e.message }, e.code === 'bad_input' ? 400 : 502)
      throw e
    }
  })

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
    const body = (await c.req.json().catch(() => null)) as { kind?: string; uploadId?: string; sample?: string; lookup?: LookupQuery; shots?: unknown; tryOn?: unknown; closet?: unknown; country?: unknown } | null
    if (!body || !JOB_KINDS.includes(body.kind as JobKind)) return c.json({ error: `kind: ${JOB_KINDS.join(' | ')}` }, 400)
    let input: JobInput
    if (body.lookup && typeof body.lookup.storeId === 'string') input = { lookup: { storeId: body.lookup.storeId, ref: body.lookup.ref, query: body.lookup.query, country: String(body.lookup.country ?? 'IE') } }
    else if (body.shots !== undefined) {
      const bad = checkShots(body.kind as JobKind, body.shots)
      if (bad) return c.json({ error: bad }, 400)
      input = { shots: (body.shots as Shot[]).map((s) => ({ uploadId: s.uploadId, view: s.view })) }
    } else if (body.uploadId) input = { uploadId: body.uploadId }
    else if (body.kind === 'try_on' && body.tryOn) {
      const t = cleanTryOn(body.tryOn)
      if (!t) return c.json({ error: 'Send person, 1 to 4 garments with label and url, and an angle.' }, 400)
      input = { tryOn: t }
    }
    else if (SAMPLES.includes(body.sample as SampleName)) input = { sample: body.sample as SampleName }
    else return c.json({ error: 'Send uploadId or sample.' }, 400)
    // новая вещь: с чем сравнить и где искать в магазине
    if (body.kind === 'import_item') {
      const closet = cleanCloset(body.closet)
      if (closet.length) input.closet = closet
      if (typeof body.country === 'string' && /^[A-Z]{2}$/.test(body.country)) input.country = body.country
    }
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

const ANGLES: Angle[] = ['front', 'three_quarter', 'side', 'back']
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Шкаф для «у тебя уже есть»: только поля, которые нужны модели, не больше 200 вещей */
export function cleanCloset(raw: unknown): ClosetRef[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, 200)
    .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
    .map((c) => ({ id: str(c.id, 80), title: str(c.title, 80), kind: GARMENT_KINDS.find((k) => k === c.kind) ?? null, color: str(c.color, 40) }))
    .flatMap((c): ClosetRef[] => (c.id && c.title ? [{ id: c.id, title: c.title, kind: c.kind, color: c.color }] : []))
}

/** Вход примерки; ссылки проверяет сам конвейер (только свои файлы и сайт приложения) */
export function cleanTryOn(raw: unknown): TryOnRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const person = str(r.person, 500)
  const angle = ANGLES.find((a) => a === r.angle) ?? 'front'
  const garments = Array.isArray(r.garments)
    ? r.garments
        .slice(0, 4)
        .map((g) => (g && typeof g === 'object' ? (g as Record<string, unknown>) : {}))
        .map((g) => ({ label: str(g.label, 80), url: str(g.url, 500), fit: str(g.fit, 200) ?? undefined }))
        .filter((g): g is { label: string; url: string; fit: string | undefined } => !!g.label && !!g.url)
    : []
  return person && garments.length ? { person, garments, angle } : null
}

const whoOf = (v: unknown): 'men' | 'women' | 'all' => (v === 'women' || v === 'all' ? v : 'men')

/** История чата: до 30 сообщений, текст до 2000 знаков */
export function cleanMessages(raw: unknown): { role: 'user' | 'assistant'; text: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(-30)
    .flatMap((m) => (m && typeof m === 'object' && ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') && str((m as { text?: unknown }).text, 2000) ? [{ role: (m as { role: 'user' | 'assistant' }).role, text: str((m as { text: string }).text, 2000)! }] : []))
}

/** Контекст Twin из приложения: только нужные поля, с ограничениями размеров */
export function cleanTwinContext(raw: unknown): TwinContext {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const wishlist = Array.isArray(r.wishlist)
    ? r.wishlist.slice(0, 100).flatMap((w) => {
        const x = (w && typeof w === 'object' ? w : {}) as Record<string, unknown>
        const id = str(x.id, 80)
        const name = str(x.name, 120)
        return id && name ? [{ id, name, storeId: str(x.storeId, 40), price: typeof x.price === 'number' ? x.price : null, currency: str(x.currency, 3), onSale: x.onSale === true }] : []
      })
    : []
  const favorites = Array.isArray(r.favorites) ? r.favorites.filter((f): f is string => typeof f === 'string').slice(0, 60) : []
  return { closet: cleanCloset(r.closet), wishlist, style: cleanStyle(r.style), favorites, country: trendCountry(typeof r.country === 'string' ? r.country : undefined), who: whoOf(r.who) }
}

/** Вещи для образов: новые (из примерки) и из шкафа */
export function cleanPieces(raw: unknown): LookPiece[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 120).flatMap((p) => {
    const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
    const id = str(x.id, 80)
    const title = str(x.title, 80)
    const kind = GARMENT_KINDS.find((k) => k === x.kind)
    return id && title && kind ? [{ id, title, kind, color: str(x.color, 40), material: str(x.material, 60), isNew: x.isNew === true }] : []
  })
}
