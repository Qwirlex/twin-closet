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
    expect(job.result.keyframes).toHaveLength(8)
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

  it('one full-height photo is enough for a body scan (one angle)', async () => {
    const { app } = setup()
    const u = await upload(app, photo, 'image/png')
    const job = await finished(app, (await (await startJob(app, { kind: 'body_scan', uploadId: u.id })).json()).id)
    expect(job.steps.slice(0, 2).map((s) => s.status)).toEqual(['done', 'done'])
    expect(job.result.keyframes).toHaveLength(1)
    expect(job.errorCode).toBe('no_key')
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
