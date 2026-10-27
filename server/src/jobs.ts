// Долгие задачи: скан шкафа, скан себя, новая вещь, примерка. Телефон опрашивает GET /jobs/:id и рисует шаги.
// Всё, что не требует моделей (видео → MP4, ключевые кадры), работает уже сейчас; шаги моделей ждут ключ Meta.
import { copyFileSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { Job, JobErrorCode, JobInput, JobKind, JobResult, JobStep, MediaInfo, SampleName } from '@twin/shared'
import { keyframes, normalizeImage, normalizeVideo, probe } from './media'
import type { MetaApi } from './meta'
import type { Store } from './store'

export class JobError extends Error {
  constructor(
    readonly code: JobErrorCode,
    message: string
  ) {
    super(message)
  }
}

type StepDef = Omit<JobStep, 'status'>

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
    { key: 'cutout', label: 'Cutting out the piece', model: 'SAM 3.1' },
    { key: 'read', label: 'Reading brand, price and size', model: 'Muse Spark' },
    { key: 'similar', label: 'Checking what you already own', model: 'Muse Spark' }
  ],
  try_on: [
    { key: 'dress', label: 'Dressing you in the look', model: 'Muse Image' },
    { key: 'protect', label: 'Keeping your face and hands real', model: 'SAM 3.1' },
    { key: 'check', label: 'Checking the result', model: 'Muse Spark' }
  ]
}

/** Сколько ключевых кадров видит Muse Spark */
const KEYFRAMES: Partial<Record<JobKind, number>> = { closet_scan: 8, body_scan: 12 }

const SAMPLE_EXT = ['.mp4', '.mov', '.jpg', '.jpeg', '.png', '.webp']

interface Source {
  path: string
  /** готовые видео и фото кэшируются — судьи не тратят кредиты на одно и то же */
  sample: SampleName | null
}

export class Jobs {
  constructor(
    private readonly store: Store,
    private readonly meta: MetaApi,
    private readonly samplesDir: string
  ) {}

  /** Создаёт задачу и запускает её в фоне; ошибки входа (нет файла, нет готового видео) — сразу исключением */
  start(kind: JobKind, input: JobInput): Job {
    const source = this.source(input)
    const now = new Date().toISOString()
    const job = this.store.addJob({
      id: this.store.id(),
      kind,
      status: 'queued',
      progress: 'Waiting to start',
      percent: 0,
      steps: STEPS[kind].map((s) => ({ ...s, status: 'pending' })),
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
    void this.run(job.id, kind, source)
    return job
  }

  private source(input: JobInput): Source {
    if ('uploadId' in input) {
      const u = this.store.upload(input.uploadId)
      if (!u) throw new JobError('bad_input', 'Upload not found. Try adding the file again.')
      return { path: this.store.path(basename(u.url)), sample: null }
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

  private async run(id: string, kind: JobKind, source: Source): Promise<void> {
    const steps = STEPS[kind]
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
      const media = await step('prepare', () => this.prepare(id, kind, source.path))
      result.media = media
      if (KEYFRAMES[kind] && media.kind === 'video' && media.duration) {
        const frames = await step('keyframes', () => keyframes(this.store.path(`${id}.mp4`), media.duration!, KEYFRAMES[kind]!, (i) => this.store.path(`${id}-k${i}.jpg`)))
        result.keyframes = frames.map((_, i) => `/files/${id}-k${i}.jpg`)
      } else if (KEYFRAMES[kind]) {
        // одно фото в полный рост вместо видео — один ракурс, кадры выбирать не из чего
        statuses.set('keyframes', 'done')
        result.keyframes = [`/files/${id}.jpg`]
      }
      for (const s of steps.filter((d) => d.model)) await step(s.key, () => this.modelStep(kind, s.key))
      sync({ status: 'done', progress: 'Done', percent: 1 })
    } catch (e) {
      const err = e instanceof JobError ? e : new JobError('internal', e instanceof Error ? e.message : String(e))
      sync({ status: 'failed', progress: err.code === 'no_key' ? 'Waiting for the Meta key' : 'Stopped', error: err.message, errorCode: err.code })
    }
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
      if (kind === 'import_item') throw new JobError('bad_input', 'Add a photo or a screenshot of the piece, not a video.')
      if ((info.duration ?? 0) > 120) throw new JobError('bad_input', 'The video is longer than two minutes. Film the rail in one slow pass of about 30 seconds.')
      return normalizeVideo(path, this.store.path(`${id}.mp4`))
    }
    if (kind === 'closet_scan') throw new JobError('bad_input', 'Closet scan needs a video. Film along the rail for about 30 seconds.')
    const out = this.store.path(`${id}.jpg`)
    if (extname(path).toLowerCase() === '.jpg' && Math.max(info.width, info.height) <= 1280) {
      copyFileSync(path, out)
      return info
    }
    return normalizeImage(path, out)
  }

  private needMeta(model: string): void {
    if (!this.meta.configured) throw new JobError('no_key', `Your file is ready. ${model} runs this step once the server has the Meta key.`)
  }

  /** Шаги моделей Meta: собираем с ключом (PLAN.md, дни 2–5) */
  private async modelStep(kind: JobKind, key: string): Promise<void> {
    throw new JobError('model', `The ${key} step of ${kind.replace('_', ' ')} is not connected to the Meta models yet.`)
  }
}
