import type { Job, Upload } from '@twin/shared'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { Store } from '../src/store'
import { PriceWatch } from '../src/watch'

// Настоящий ffmpeg: короткое тестовое видео с телефона «боком» (портрет) и картинка
const dir = mkdtempSync(join(tmpdir(), 'twin-test-'))
const video = join(dir, 'rail.mov')
const photo = join(dir, 'shot.png')
const samples = join(dir, 'samples')

beforeAll(() => {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1080x1920:rate=30:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=800x600', '-frames:v', '1', photo])
})

function setup() {
  const store = new Store(mkdtempSync(join(dir, 'data-')))
  const meta = new MetaApi('')
  const jobs = new Jobs(store, meta, samples)
  const app = createApp({ store, jobs, meta, watch: new PriceWatch(store, meta, PriceWatch.jobSearch(jobs, meta)) })
  return { store, app }
}

async function upload(app: ReturnType<typeof setup>['app'], path: string, type: string): Promise<Upload> {
  const form = new FormData()
  form.append('file', new File([readFileSync(path)], path.split(/[\\/]/).pop()!, { type }))
  const res = await app.request('/uploads', { method: 'POST', body: form })
  expect(res.status).toBe(201)
  return res.json()
}

async function startJob(app: ReturnType<typeof setup>['app'], body: object): Promise<Response> {
  return app.request('/jobs', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

async function finished(app: ReturnType<typeof setup>['app'], id: string): Promise<Job> {
  for (let i = 0; i < 300; i++) {
    const job = (await (await app.request(`/jobs/${id}`)).json()) as Job
    if (job.status === 'done' || job.status === 'failed') return job
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('job did not finish')
}

describe('jobs without the Meta key', () => {
  it('closet scan prepares the video and key frames, then waits for the key at the first model step', async () => {
    const { app, store } = setup()
    const u = await upload(app, video, 'video/quicktime')
    expect(u.kind).toBe('video')
    const job = await finished(app, (await (await startJob(app, { kind: 'closet_scan', uploadId: u.id })).json()).id)

    expect(job.status).toBe('failed')
    expect(job.errorCode).toBe('no_key')
    expect(job.steps.map((s) => s.status)).toEqual(['done', 'done', 'failed', 'pending', 'pending', 'pending'])
    expect(job.percent).toBeCloseTo(2 / 6)
    // портрет остаётся портретом и ужимается до 1280 по длинной стороне
    expect(job.result.media).toMatchObject({ kind: 'video', width: 720, height: 1280 })
    expect(job.result.media?.duration).toBeGreaterThan(2.5)
    // лучшие кадры: не больше 8, без повторов; у каждого — секунда в видео
    expect(job.result.keyframes!.length).toBeGreaterThan(0)
    expect(job.result.keyframes!.length).toBeLessThanOrEqual(8)
    expect(job.result.keyframeTimes).toHaveLength(job.result.keyframes!.length)
    for (const url of job.result.keyframes!) expect(existsSync(store.path(url.split('/').pop()!))).toBe(true)
    expect((await app.request(job.result.keyframes![0])).headers.get('content-type')).toBe('image/jpeg')
  }, 60_000)

  it('a screenshot becomes a JPEG before the cut-out step', async () => {
    const { app } = setup()
    const u = await upload(app, photo, 'image/png')
    const job = await finished(app, (await (await startJob(app, { kind: 'import_item', uploadId: u.id })).json()).id)
    expect(job.errorCode).toBe('no_key')
    expect(job.steps[0].status).toBe('done')
    expect(job.result.media).toMatchObject({ kind: 'image', width: 800, height: 600 })
  }, 30_000)

  it('a short video of a piece: up to 5 sharp frames, the sharpest is the main photo, then waits for the key', async () => {
    const { app, store } = setup()
    const u = await upload(app, video, 'video/quicktime')
    const job = await finished(app, (await (await startJob(app, { kind: 'import_item', uploadId: u.id })).json()).id)
    expect(job.steps.map((s) => s.key)).toEqual(['prepare', 'keyframes', 'read', 'cutout', 'online', 'similar'])
    expect(job.steps.map((s) => s.status)).toEqual(['done', 'done', 'failed', 'pending', 'pending', 'pending'])
    expect(job.errorCode).toBe('no_key')
    expect(job.result.keyframes!.length).toBeGreaterThan(0)
    expect(job.result.keyframes!.length).toBeLessThanOrEqual(5)
    expect(job.result.keyframeTimes).toHaveLength(job.result.keyframes!.length)
    // главное фото — по нему SAM вырежет вещь, его же приложение ставит на плитку
    expect(existsSync(store.path(`${job.id}.jpg`))).toBe(true)
  }, 60_000)

  it('a piece video longer than 15 seconds gets a clear error', async () => {
    const { app } = setup()
    const long = join(dir, 'long.mp4')
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', long])
    const u = await upload(app, long, 'video/mp4')
    const job = await finished(app, (await (await startJob(app, { kind: 'import_item', uploadId: u.id })).json()).id)
    expect(job).toMatchObject({ status: 'failed', errorCode: 'bad_input', error: expect.stringMatching(/up to 15 seconds/) })
  }, 60_000)

  it('one full-height photo is enough for a body scan (one angle)', async () => {
    const { app } = setup()
    const u = await upload(app, photo, 'image/png')
    const job = await finished(app, (await (await startJob(app, { kind: 'body_scan', uploadId: u.id })).json()).id)
    expect(job.steps.slice(0, 2).map((s) => s.status)).toEqual(['done', 'done'])
    expect(job.result.keyframes).toHaveLength(1)
    expect(job.errorCode).toBe('no_key')
  }, 30_000)

  it('a guided body scan takes 4 labelled photos: angles are known, masks wait for the key', async () => {
    const { app, store } = setup()
    const ids = await Promise.all([1, 2, 3, 4].map(async () => (await upload(app, photo, 'image/png')).id))
    // в любом порядке — на сервере встают по ракурсам
    const shots = [
      { uploadId: ids[0], view: 'back' },
      { uploadId: ids[1], view: 'front' },
      { uploadId: ids[2], view: 'side' },
      { uploadId: ids[3], view: 'three_quarter' }
    ]
    const job = await finished(app, (await (await startJob(app, { kind: 'body_scan', shots })).json()).id)
    expect(job.steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'failed'])
    expect(job.errorCode).toBe('no_key')
    expect(job.result.shots!.map((s) => s.view)).toEqual(['front', 'three_quarter', 'side', 'back'])
    expect(job.result.keyframes).toEqual(job.result.shots!.map((s) => s.url))
    for (const s of job.result.shots!) expect(existsSync(store.path(s.url.split('/').pop()!))).toBe(true)
    expect(existsSync(store.path(`${job.id}.jpg`))).toBe(true)
  }, 30_000)

  it('a piece one by one: front, back and the label in one job', async () => {
    const { app } = setup()
    const ids = await Promise.all([1, 2, 3].map(async () => (await upload(app, photo, 'image/png')).id))
    const shots = [
      { uploadId: ids[0], view: 'label' },
      { uploadId: ids[1], view: 'front' },
      { uploadId: ids[2], view: 'back' }
    ]
    const job = await finished(app, (await (await startJob(app, { kind: 'import_item', shots })).json()).id)
    expect(job.steps[0].status).toBe('done')
    expect(job.errorCode).toBe('no_key')
    expect(job.result.shots!.map((s) => s.view)).toEqual(['front', 'back', 'label'])
    expect(job.result.media).toMatchObject({ kind: 'image', width: 800, height: 600 })
  }, 30_000)

  it('refuses a broken photo set with a clear reason', async () => {
    const { app } = setup()
    const p = await upload(app, photo, 'image/png')
    const v = await upload(app, video, 'video/quicktime')
    const err = async (kind: string, shots: unknown) => {
      const res = await startJob(app, { kind, shots })
      return { status: res.status, error: (await res.json()).error as string }
    }
    expect(await err('body_scan', [{ uploadId: p.id, view: 'side' }])).toMatchObject({ status: 400, error: expect.stringMatching(/front/) })
    expect(await err('body_scan', [{ uploadId: p.id, view: 'front' }, { uploadId: p.id, view: 'front' }])).toMatchObject({ status: 400, error: expect.stringMatching(/once/) })
    expect(await err('body_scan', [{ uploadId: p.id, view: 'label' }])).toMatchObject({ status: 400 })
    expect(await err('closet_scan', [{ uploadId: p.id, view: 'front' }])).toMatchObject({ status: 400 })
    expect(await err('import_item', [])).toMatchObject({ status: 400 })
    expect(await err('import_item', [{ uploadId: 'nope', view: 'front' }])).toMatchObject({ status: 404, error: expect.stringMatching(/not found/) })
    expect(await err('import_item', [{ uploadId: v.id, view: 'front' }])).toMatchObject({ status: 404, error: expect.stringMatching(/photo, not a video/) })
  }, 30_000)

  it('says what to do with the wrong kind of file', async () => {
    const { app } = setup()
    const u = await upload(app, photo, 'image/png')
    const job = await finished(app, (await (await startJob(app, { kind: 'closet_scan', uploadId: u.id })).json()).id)
    expect(job.errorCode).toBe('bad_input')
    expect(job.error).toMatch(/needs a video/)
  }, 30_000)

  it('refuses unknown files and missing samples', async () => {
    const { app } = setup()
    const form = new FormData()
    form.append('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect((await app.request('/uploads', { method: 'POST', body: form })).status).toBe(415)
    const res = await startJob(app, { kind: 'closet_scan', sample: 'closet' })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/sample/)
    expect((await app.request('/files/..%2Fdb.json')).status).toBe(400)
  })

  it('a sample that already ran returns the cached result at once', async () => {
    const { app, store } = setup()
    const now = new Date().toISOString()
    store.addJob({ id: 'old', kind: 'closet_scan', status: 'done', progress: 'Done', percent: 1, steps: [], error: null, errorCode: null, result: { keyframes: ['/files/x.jpg'] }, sample: 'closet', createdAt: now, updatedAt: now })
    mkdirSync(samples, { recursive: true })
    copyFileSync(video, join(samples, 'closet.mov'))
    const job = (await (await startJob(app, { kind: 'closet_scan', sample: 'closet' })).json()) as Job
    expect(job.status).toBe('done')
    expect(job.result.keyframes).toEqual(['/files/x.jpg'])
  }, 30_000)
})
