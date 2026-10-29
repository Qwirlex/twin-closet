// Долгие задачи: скан шкафа, скан себя, новая вещь, примерка. Телефон опрашивает GET /jobs/:id и рисует шаги.
// Всё, что не требует моделей (видео → MP4, ключевые кадры), работает уже сейчас; шаги моделей ждут ключ Meta.
import { copyFileSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { isLiveStore, isStorePage, LIVE_STORE_IDS, LIVE_STORES, SHOT_RULES, type Job, type JobErrorCode, type JobInput, type JobKind, type JobResult, type JobStep, type MediaInfo, type SampleName, type ShotView } from '@twin/shared'
import { normalizeImage, normalizeVideo, probe, smartKeyframes } from './media'
import { findProduct, runTask, storeLinks, text, type FoundProducts } from './models/spark'
import type { MetaApi } from './meta'
import type { Store } from './store'
import { JobError } from './errors'
import type { StepContext } from './pipeline/context'
import { maskBody, pickBodyAngles } from './pipeline/body'
import { cutCloset, detectCloset, tagCloset, trackCloset } from './pipeline/closet'
import { cutItem, findOnline, readItem, similarItems } from './pipeline/item'
import { checkRender, dress, protect } from './pipeline/tryon'

export { JobError }

type StepDef = Omit<JobStep, 'status'>

/** Шаги моделей по задачам (server/src/pipeline/*); поиск вещи в магазине — ниже, в modelStep */
const PIPELINES: Partial<Record<JobKind, Record<string, (ctx: StepContext) => Promise<void>>>> = {
  import_item: { read: readItem, cutout: cutItem, online: findOnline, similar: similarItems },
  closet_scan: { detect: detectCloset, track: trackCloset, cutout: cutCloset, tag: tagCloset },
  body_scan: { angles: pickBodyAngles, masks: maskBody },
  try_on: { dress, protect, check: checkRender }
}

const STEPS: Record<JobKind, StepDef[]> = {
  closet_scan: [
    { key: 'prepare', label: 'Preparing your video', model: null },
    { key: 'keyframes', label: 'Picking key frames', model: null },
    { key: 'detect', label: 'Finding every piece', model: 'Muse Spark' },
    { key: 'track', label: 'Tracking pieces through the video', model: 'SAM 3.1' },
    { key: 'cutout', label: 'Cutting out the best frame of each', model: 'SAM 3.1' },
    { key: 'tag', label: 'Tagging and removing duplicates', model: 'Muse Spark' }
  ],
  body_scan: [
    { key: 'prepare', label: 'Preparing your video or photo', model: null },
    { key: 'keyframes', label: 'Picking the clearest frames', model: null },
    { key: 'angles', label: 'Choosing front, 3/4, side and back', model: 'Muse Spark' },
    { key: 'masks', label: 'Masking face, hands and clothes', model: 'SAM 3.1' }
  ],
  import_item: [
    { key: 'prepare', label: 'Preparing the photo', model: null },
    // вещь коротким роликом: лучшие кадры; у фото и скриншота шаг сразу готов
    { key: 'keyframes', label: 'Picking the sharpest frames', model: null },
    // сначала Spark понимает, что это за вещь, — по её названию SAM и вырезает
    { key: 'read', label: 'Reading brand, price and size', model: 'Muse Spark' },
    { key: 'cutout', label: 'Cutting out the piece', model: 'SAM 3.1' },
    { key: 'online', label: 'Finding it online', model: 'Muse Spark' },
    { key: 'similar', label: 'Checking what you already own', model: 'Muse Spark' }
  ],
  try_on: [
    { key: 'dress', label: 'Dressing you in the look', model: 'Muse Image' },
    { key: 'protect', label: 'Keeping your face and hands real', model: 'SAM 3.1' },
    { key: 'check', label: 'Checking the result', model: 'Muse Spark' }
  ],
  product_lookup: [
    { key: 'search', label: 'Searching the store', model: 'Muse Spark' },
    { key: 'read', label: 'Reading price and sizes', model: 'Muse Spark' }
  ]
}

/** Шаги задачи; у умного скана снимки и ракурсы уже выбраны на телефоне — подписи об этом */
function stepsFor(kind: JobKind, input: JobInput): StepDef[] {
  if (!('shots' in input)) return STEPS[kind]
  const n = input.shots.length
  const label: Record<string, string> = {
    prepare: `Preparing your ${n === 1 ? 'photo' : `${n} photos`}`,
    keyframes: 'Sharp, steady photos picked on your phone',
    angles: 'Angles marked while you turned'
  }
  return STEPS[kind].map((s) => (label[s.key] ? { ...s, label: label[s.key] } : s))
}

/** Сколько ключевых кадров видит Muse Spark */
const KEYFRAMES: Partial<Record<JobKind, number>> = { closet_scan: 8, body_scan: 12, import_item: 5 }

const SAMPLE_EXT = ['.mp4', '.mov', '.jpg', '.jpeg', '.png', '.webp']

export const STORE_NAMES: Record<string, string> = Object.fromEntries(LIVE_STORE_IDS.map((id) => [id, LIVE_STORES[id].name]))


interface Source {
  /** null — задача без файла (поиск вещи в магазине) */
  path: string | null
  /** готовые видео и фото кэшируются — судьи не тратят кредиты на одно и то же */
  sample: SampleName | null
  /** файл загрузки в хранилище: после перезапуска его докачивают из Supabase */
  upload?: string
  /** снимки умного скана, по порядку ракурсов; главный — первый */
  shots?: { path: string; upload: string; view: ShotView }[]
}

export class Jobs {
  constructor(
    private readonly store: Store,
    private readonly meta: MetaApi,
    private readonly samplesDir: string,
    private readonly log: (m: string) => void = console.log,
    /** скачивание демо-фото с сайта приложения для примерки (в тестах — подмена) */
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /** Создаёт задачу и запускает её в фоне; ошибки входа (нет файла, нет готового видео) — сразу исключением */
  start(kind: JobKind, input: JobInput): Job {
    const source = this.source(input, kind)
    const now = new Date().toISOString()
    const job = this.store.addJob({
      id: this.store.id(),
      kind,
      status: 'queued',
      progress: 'Waiting to start',
      percent: 0,
      steps: stepsFor(kind, input).map((s) => ({ ...s, status: 'pending' })),
      error: null,
      errorCode: null,
      result: {},
      sample: source.sample,
      createdAt: now,
      updatedAt: now
    })
    const cached = source.sample && this.cached(kind, source.sample)
    if (cached) {
      return this.store.updateJob(job.id, { status: 'done', percent: 1, progress: 'Done', steps: cached.steps, result: cached.result })
    }
    void this.run(job.id, kind, source, input)
    return job
  }

  /** Ждёт, пока задача закончится (для проверки цен на сервере; телефон опрашивает сам) */
  async wait(id: string, timeoutMs = 120_000): Promise<Job> {
    const until = Date.now() + timeoutMs
    for (;;) {
      const job = this.store.job(id)!
      if (job.status === 'done' || job.status === 'failed' || Date.now() > until) return job
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  private source(input: JobInput, kind: JobKind): Source {
    if ('lookup' in input) {
      if (!isLiveStore(input.lookup.storeId)) throw new JobError('bad_input', 'Searching this store is coming soon.')
      if (!input.lookup.ref?.trim() && !input.lookup.query?.trim()) throw new JobError('bad_input', 'Send the REF from the tag or a short description.')
      return { path: null, sample: null }
    }
    if ('shots' in input) {
      // по порядку ракурсов: перед, ¾, бок, спина — главный снимок первым
      const order = SHOT_RULES[kind]?.views ?? []
      const sorted = [...input.shots].sort((a, b) => order.indexOf(a.view) - order.indexOf(b.view))
      const shots = sorted.map((shot) => {
        const u = this.store.upload(shot.uploadId)
        if (!u) throw new JobError('bad_input', 'A photo was not found. Take it again.')
        if (u.kind !== 'image') throw new JobError('bad_input', 'Each view is a photo, not a video.')
        return { path: this.store.path(basename(u.url)), upload: basename(u.url), view: shot.view }
      })
      return { path: shots[0].path, sample: null, shots }
    }
    if ('uploadId' in input) {
      const u = this.store.upload(input.uploadId)
      if (!u) throw new JobError('bad_input', 'Upload not found. Try adding the file again.')
      return { path: this.store.path(basename(u.url)), sample: null, upload: basename(u.url) }
    }
    if ('tryOn' in input) {
      const t = input.tryOn
      if (!t || typeof t.person !== 'string' || !Array.isArray(t.garments) || !t.garments.length || t.garments.length > 4) throw new JobError('bad_input', 'Send a photo of the person and 1 to 4 pieces.')
      return { path: null, sample: null }
    }
    const ext = SAMPLE_EXT.find((e) => existsSync(join(this.samplesDir, `${input.sample}${e}`)))
    if (!ext) throw new JobError('bad_input', 'The sample video is not on this server yet.')
    return { path: join(this.samplesDir, `${input.sample}${ext}`), sample: input.sample }
  }

  private cached(kind: JobKind, sample: SampleName): Job | undefined {
    return this.store
      .jobs()
      .filter((j) => j.kind === kind && j.status === 'done' && j.sample === sample)
      .at(-1)
  }

  private async run(id: string, kind: JobKind, source: Source, input: JobInput): Promise<void> {
    const steps = stepsFor(kind, input)
    const statuses = new Map(steps.map((s) => [s.key, 'pending' as JobStep['status']]))
    const result: JobResult = {}
    const sync = (patch: Partial<Job> = {}) => {
      const done = [...statuses.values()].filter((s) => s === 'done').length
      this.store.updateJob(id, { steps: steps.map((s) => ({ ...s, status: statuses.get(s.key)! })), percent: done / steps.length, result: { ...result }, ...patch })
    }
    const step = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
      const def = steps.find((s) => s.key === key)!
      statuses.set(key, 'running')
      sync({ status: 'running', progress: def.label })
      try {
        if (def.model) this.needMeta(def.model)
        const out = await fn()
        statuses.set(key, 'done')
        sync()
        return out
      } catch (e) {
        statuses.set(key, 'failed')
        throw e
      }
    }

    try {
      if (source.upload && !(await this.store.ensure(source.upload))) throw new JobError('bad_input', 'The file is no longer on the server. Add it again.')
      for (const shot of source.shots ?? []) if (!(await this.store.ensure(shot.upload))) throw new JobError('bad_input', 'A photo is no longer on the server. Take it again.')
      const media = source.shots
        ? await step('prepare', () => this.prepareShots(id, kind, source.shots!, result))
        : source.path
          ? await step('prepare', () => this.prepare(id, kind, source.path!))
          : null
      if (media) result.media = media
      if (source.shots) {
        // снимки уже выбраны на телефоне (поза, резкость, свет) — их и видят модели
        if (KEYFRAMES[kind]) {
          statuses.set('keyframes', 'done')
          result.keyframes = result.shots!.map((s) => s.url)
        }
        // ракурсы подписаны при съёмке — выбирать их моделью не нужно
        if (kind === 'body_scan') statuses.set('angles', 'done')
      } else if (!media) {
        // поиск вещи в магазине: файла нет, сразу шаги моделей
      } else if (KEYFRAMES[kind] && media.kind === 'video' && media.duration) {
        // лучшие кадры: резкие, без повторов, по всему проходу (docs/spec-smart-frames.md)
        const frames = await step('keyframes', () => smartKeyframes(this.store.path(`${id}.mp4`), media, KEYFRAMES[kind]!, (i) => this.store.path(`${id}-k${i}.jpg`)))
        result.keyframes = frames.paths.map((_, i) => `/files/${id}-k${i}.jpg`)
        result.keyframeTimes = frames.times
        // вещь роликом: самый резкий кадр — главное фото, по нему SAM вырезает вещь
        if (kind === 'import_item') copyFileSync(frames.paths[frames.sharp.indexOf(Math.max(...frames.sharp))], this.store.path(`${id}.jpg`))
      } else if (KEYFRAMES[kind]) {
        // одно фото в полный рост вместо видео — один ракурс, кадры выбирать не из чего
        statuses.set('keyframes', 'done')
        result.keyframes = [`/files/${id}.jpg`]
      }
      const ctx: StepContext = { meta: this.meta, store: this.store, jobId: id, input, result, scratch: {}, fetchImpl: this.fetchImpl }
      for (const s of steps.filter((d) => d.model && statuses.get(d.key) !== 'done')) await step(s.key, () => this.modelStep(kind, s.key, ctx))
      sync({ status: 'done', progress: 'Done', percent: 1 })
    } catch (e) {
      const err = e instanceof JobError ? e : new JobError('internal', e instanceof Error ? e.message : String(e))
      sync({ status: 'failed', progress: err.code === 'no_key' ? 'Waiting for the Meta key' : 'Stopped', error: err.message, errorCode: err.code })
    }
    // кадры и результаты — в Supabase, чтобы пережили перезапуск сервера (без Supabase ничего не делает)
    await this.store.keepJobFiles(id).catch((e) => this.log(`Supabase: файлы задачи ${id} не сохранились (${e instanceof Error ? e.message : e})`))
  }

  private async prepare(id: string, kind: JobKind, path: string): Promise<MediaInfo> {
    if (kind === 'try_on') return { kind: 'image', width: 0, height: 0, duration: null, frames: null }
    let info: MediaInfo
    try {
      info = await probe(path)
    } catch {
      throw new JobError('bad_input', 'This file is not a photo or a video we can read.')
    }
    if (info.kind === 'video') {
      if (kind === 'import_item' && (info.duration ?? 0) > 15) throw new JobError('bad_input', 'Film the piece for up to 15 seconds: the front, a slow turn, the back.')
      if ((info.duration ?? 0) > 120) throw new JobError('bad_input', 'The video is longer than two minutes. Film the rail in one slow pass of about 30 seconds.')
      return normalizeVideo(path, this.store.path(`${id}.mp4`), info)
    }
    if (kind === 'closet_scan') throw new JobError('bad_input', 'Closet scan needs a video. Film along the rail for about 30 seconds.')
    const out = this.store.path(`${id}.jpg`)
    if (extname(path).toLowerCase() === '.jpg' && Math.max(info.width, info.height) <= 1280) {
      copyFileSync(path, out)
      return info
    }
    return normalizeImage(path, out)
  }

  /** Снимки умного скана → JPEG до 1280 px; главный (первый) — ещё и `${id}.jpg`, как у одиночного фото */
  private async prepareShots(id: string, kind: JobKind, shots: NonNullable<Source['shots']>, result: JobResult): Promise<MediaInfo> {
    const infos: MediaInfo[] = []
    result.shots = []
    for (const [i, shot] of shots.entries()) {
      const info = await this.prepare(`${id}-s${i}`, kind, shot.path)
      if (info.kind !== 'image') throw new JobError('bad_input', 'Each view is a photo, not a video.')
      infos.push(info)
      result.shots.push({ view: shot.view, url: `/files/${id}-s${i}.jpg` })
    }
    copyFileSync(this.store.path(`${id}-s0.jpg`), this.store.path(`${id}.jpg`))
    return infos[0]
  }

  private needMeta(model: string): void {
    if (!this.meta.configured) throw new JobError('no_key', `Your file is ready. ${model} runs this step once the server has the Meta key.`)
  }

  /**
   * Шаги моделей Meta. Поиск вещи в магазине — только Muse Spark с веб-поиском, подключён.
   * Остальное (SAM и примерка) собираем с ключом, когда увидим живые ответы (PLAN.md, дни 2–5)
   */
  private async modelStep(kind: JobKind, key: string, ctx: StepContext): Promise<void> {
    const pipeline = PIPELINES[kind]?.[key]
    if (pipeline) return pipeline(ctx)
    if (kind === 'product_lookup' && 'lookup' in ctx.input) {
      const q = ctx.input.lookup
      if (!isLiveStore(q.storeId)) throw new JobError('bad_input', 'Searching this store is coming soon.')
      const store = LIVE_STORES[q.storeId]
      if (key === 'search') {
        const lines = [q.ref ? `Article reference (REF): ${q.ref}` : null, q.query ? `Item: ${q.query}` : null, `Country: ${q.country}`].filter(Boolean)
        const { data, raw } = await runTask(this.meta, findProduct(store), [text(lines.join('\n'))], { webSearchCountry: q.country }).catch((e) => {
          throw new JobError('model', `Muse Spark search failed: ${e instanceof Error ? e.message : e}`)
        })
        ctx.scratch.products = data.products
        ctx.scratch.links = storeLinks(raw, store.id)
        return
      }
      if (key === 'read') {
        const found = (ctx.scratch.products as FoundProducts['products'] | undefined) ?? []
        const links = (ctx.scratch.links as string[] | undefined) ?? []
        const host = (u: string) => {
          try {
            return new URL(u).hostname
          } catch {
            return null
          }
        }
        const onStore = (u: string) => isStorePage(u, store.id)
        // ссылка с другого сайта — вещь отбрасываем; битую или пустую ссылку заменяем страницей магазина из цитат
        const spare = links.filter((l) => !found.some((p) => p.url === l))
        ctx.result.products = found
          .filter((p) => !host(p.url) || onStore(p.url))
          .map((p) => ({ ...p, url: host(p.url) ? p.url : (spare.shift() ?? '') }))
          .filter((p) => onStore(p.url))
          .map((p) => ({ title: p.title, url: p.url, price: p.price, currency: p.currency, snippet: '' }))
        return
      }
    }
    throw new JobError('model', `The ${key} step of ${kind.replace('_', ' ')} is not connected to the Meta models yet.`)
  }
}
