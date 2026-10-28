import type { Job, Upload } from '@twin/shared'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { cleanup } from '../src/cleanup'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { BadForm, saveFileField, UploadTooLarge } from '../src/multipart'
import { Store } from '../src/store'
import { Supabase } from '../src/supabase'
import { PriceWatch } from '../src/watch'

const dir = mkdtempSync(join(tmpdir(), 'twin-storage-'))
const photo = join(dir, 'shot.png')

beforeAll(() => {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=800x600', '-frames:v', '1', photo])
})

/** Форма так, как её шлёт браузер или телефон, — нарезанная на куски по size байт */
async function formStream(form: FormData, size: number): Promise<{ body: ReadableStream<Uint8Array>; type: string }> {
  const req = new Request('http://local/uploads', { method: 'POST', body: form })
  const bytes = new Uint8Array(await req.arrayBuffer())
  let at = 0
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (at >= bytes.length) return c.close()
      c.enqueue(bytes.slice(at, at + size))
      at += size
    }
  })
  return { body, type: req.headers.get('content-type')! }
}

describe('streaming upload', () => {
  // байты, похожие на границу формы и переводы строк, — парсер не должен на них споткнуться
  const tricky = Buffer.concat([Buffer.from('\r\n--\r\n\r\n--WebKitFormBoundary'), Buffer.alloc(70_000, 7), Buffer.from('\r\n-'), Buffer.from([0, 13, 10, 45, 45])])

  for (const chunk of [7, 64 * 1024, 1 << 20]) {
    it(`saves the file field exactly, chunks of ${chunk} bytes`, async () => {
      const form = new FormData()
      form.append('note', 'before the file')
      form.append('file', new File([tricky], 'rail.mov', { type: 'video/quicktime' }))
      form.append('after', 'x')
      const out = join(dir, `up-${chunk}.bin`)
      const { body, type } = await formStream(form, chunk)
      const saved = await saveFileField(body, type, 'file', 1 << 20, (f) => (f.type === 'video/quicktime' && f.filename === 'rail.mov' ? out : null))
      expect(saved).toEqual({ path: out, filename: 'rail.mov', type: 'video/quicktime', size: tricky.length })
      expect(readFileSync(out).equals(tricky)).toBe(true)
    })
  }

  it('says null without the field, skips a file of the wrong type, refuses big and broken forms', async () => {
    const noFile = new FormData()
    noFile.append('file', 'just text')
    const a = await formStream(noFile, 100)
    expect(await saveFileField(a.body, a.type, 'file', 1000, () => join(dir, 'never'))).toBeNull()

    const pdf = new FormData()
    pdf.append('file', new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }))
    const b = await formStream(pdf, 100)
    expect(await saveFileField(b.body, b.type, 'file', 1000, () => null)).toEqual({ path: null, filename: 'doc.pdf', type: 'application/pdf', size: 0 })

    const big = new FormData()
    big.append('file', new File([Buffer.alloc(5000)], 'big.jpg', { type: 'image/jpeg' }))
    const c = await formStream(big, 512)
    const bigOut = join(dir, 'big.jpg')
    await expect(saveFileField(c.body, c.type, 'file', 4000, () => bigOut)).rejects.toBeInstanceOf(UploadTooLarge)
    expect(existsSync(bigOut)).toBe(false)

    const cut = new FormData()
    cut.append('file', new File([Buffer.alloc(5000, 1)], 'cut.jpg', { type: 'image/jpeg' }))
    const req = new Request('http://local/', { method: 'POST', body: cut })
    const half = new Uint8Array(await req.arrayBuffer()).slice(0, 3000)
    const cutOut = join(dir, 'cut.jpg')
    await expect(saveFileField(new Response(half).body!, req.headers.get('content-type')!, 'file', 10_000, () => cutOut)).rejects.toBeInstanceOf(BadForm)
    expect(existsSync(cutOut)).toBe(false)
    await expect(saveFileField(new Response('x').body!, 'application/json', 'file', 10, () => cutOut)).rejects.toBeInstanceOf(BadForm)
  })
})

/** Supabase в памяти: те же адреса REST, что у настоящего, и проверка, что секретный ключ идёт только в apikey */
function fakeSupabase() {
  const state = new Map<string, unknown>()
  const files = new Map<string, { bytes: Buffer; updatedAt: string }>()
  const calls: string[] = []
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const headers = new Headers(init.headers)
    const method = init.method ?? 'GET'
    calls.push(`${method} ${url.pathname}`)
    if (headers.get('apikey') !== 'sb_secret_test' || headers.has('authorization')) return new Response('{"message":"Invalid API key"}', { status: 401 })
    const body = init.body
    const json = () => JSON.parse(String(body))
    const path = url.pathname
    if (path === '/rest/v1/server_state' && method === 'GET') {
      const like = url.searchParams.get('key')?.replace(/^like\./, '').replace(/\*$/, '') ?? ''
      return Response.json([...state].filter(([key]) => key.startsWith(like)).map(([key, data]) => ({ key, data })))
    }
    if (path === '/rest/v1/server_state' && method === 'POST') {
      for (const r of json() as { key: string; data: unknown }[]) state.set(r.key, JSON.parse(JSON.stringify(r.data)))
      return new Response(null, { status: 201 })
    }
    const object = path.match(/^\/storage\/v1\/object\/(?:authenticated\/)?server-files\/(.+)$/)
    if (object && method === 'POST') {
      files.set(decodeURIComponent(object[1]), { bytes: Buffer.from(body as Uint8Array), updatedAt: new Date().toISOString() })
      return Response.json({ Key: `server-files/${object[1]}` })
    }
    if (object && method === 'GET') {
      const f = files.get(decodeURIComponent(object[1]))
      return f ? new Response(new Uint8Array(f.bytes)) : new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 })
    }
    if (path === '/storage/v1/object/server-files' && method === 'DELETE') {
      for (const n of (json() as { prefixes: string[] }).prefixes) files.delete(n)
      return Response.json([])
    }
    if (path === '/storage/v1/object/list/server-files' && method === 'POST') {
      const { limit, offset, prefix } = json() as { limit: number; offset: number; prefix: string }
      const inFolder = [...files].filter(([name]) => name.startsWith(`${prefix}/`))
      return Response.json(inFolder.slice(offset, offset + limit).map(([name, f]) => ({ name: name.slice(prefix.length + 1), id: name, updated_at: f.updatedAt, created_at: f.updatedAt })))
    }
    return new Response('not found', { status: 404 })
  }) as typeof fetch
  return { state, files, calls, supabase: new Supabase('https://test.supabase.co', 'sb_secret_test', fetchImpl) }
}

async function boot(remote: Supabase) {
  const store = await Store.open(mkdtempSync(join(dir, 'data-')), remote, () => {})
  const meta = new MetaApi('')
  const jobs = new Jobs(store, meta, join(dir, 'samples'), () => {})
  const app = createApp({ store, jobs, meta, watch: new PriceWatch(store, meta, PriceWatch.jobSearch(jobs, meta)), log: () => {} })
  return { store, app }
}

async function finished(app: Awaited<ReturnType<typeof boot>>['app'], id: string): Promise<Job> {
  for (let i = 0; i < 300; i++) {
    const job = (await (await app.request(`/jobs/${id}`)).json()) as Job
    if (job.status === 'done' || job.status === 'failed') return job
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('job did not finish')
}

describe('state and files in Supabase', () => {
  it('reads env only with both values; the space is main unless set', () => {
    expect(Supabase.fromEnv({ SUPABASE_URL: 'https://x.supabase.co/' })).toBeNull()
    const s = Supabase.fromEnv({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SECRET_KEY: ' sb_secret_1 ' })
    expect([s?.url, s?.space]).toEqual(['https://x.supabase.co', 'main'])
    expect(Supabase.fromEnv({ SUPABASE_URL: 'https://x', SUPABASE_SECRET_KEY: 'k', SUPABASE_SPACE: 'dev' })?.space).toBe('dev')
    expect(() => Supabase.fromEnv({ SUPABASE_URL: 'https://x', SUPABASE_SECRET_KEY: 'k', SUPABASE_SPACE: '../x' })).toThrow(/SUPABASE_SPACE/)
  })

  it('keeps the server on the computer and the one on Render apart', async () => {
    const fake = fakeSupabase()
    const fetchImpl = (fake.supabase as unknown as { fetchImpl: typeof fetch }).fetchImpl
    const dev = await Store.open(mkdtempSync(join(dir, 'data-')), new Supabase('https://test.supabase.co', 'sb_secret_test', fetchImpl, 'dev'), () => {})
    const main = await Store.open(mkdtempSync(join(dir, 'data-')), fake.supabase, () => {})
    dev.setWatch([{ id: 'w-dev' } as never])
    main.setWatch([{ id: 'w-main' } as never])
    await Promise.all([dev.flush(), main.flush()])
    expect([...fake.state.keys()].sort()).toEqual(['dev/watch', 'main/watch'])
    const again = await Store.open(mkdtempSync(join(dir, 'data-')), fake.supabase, () => {})
    expect(again.watch().map((w) => w.id)).toEqual(['w-main'])
  })

  it('survives a restart with an empty disk: state, files and a retry of an old upload', async () => {
    const fake = fakeSupabase()
    const first = await boot(fake.supabase)
    expect((await (await first.app.request('/health')).json()).storage).toBe('supabase')

    const form = new FormData()
    form.append('file', new File([readFileSync(photo)], 'shot.png', { type: 'image/png' }))
    const upload = (await (await first.app.request('/uploads', { method: 'POST', body: form })).json()) as Upload
    const job = await finished(first.app, ((await (await first.app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'import_item', uploadId: upload.id }), headers: { 'content-type': 'application/json' } })).json()) as Job).id)
    expect(job.errorCode).toBe('no_key')
    expect(job.steps[0].status).toBe('done')
    await first.store.flush()
    await new Promise((r) => setTimeout(r, 50))

    // в Supabase: загрузка, нормализованное фото задачи и состояние с обеими записями
    expect([...fake.files.keys()].sort()).toEqual([`main/${job.id}.jpg`, `main/${upload.id}.png`].sort())
    expect((fake.state.get('main/uploads') as Upload[]).map((u) => u.id)).toEqual([upload.id])
    expect((fake.state.get('main/jobs') as Job[]).find((j) => j.id === job.id)?.status).toBe('failed')

    // новый сервер с пустой рабочей папкой
    const second = await boot(fake.supabase)
    expect(second.store.upload(upload.id)?.size).toBe(readFileSync(photo).length)
    const file = await second.app.request(`/files/${job.id}.jpg`)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toBe('image/jpeg')
    expect(Buffer.from(await file.arrayBuffer()).equals(fake.files.get(`main/${job.id}.jpg`)!.bytes)).toBe(true)
    expect((await second.app.request('/files/nope.jpg')).status).toBe(404)
    // ключ Meta пришёл — та же загрузка снова в работе: файл докачивается из Supabase
    const retry = await finished(second.app, ((await (await second.app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'import_item', uploadId: upload.id }), headers: { 'content-type': 'application/json' } })).json()) as Job).id)
    expect(retry.steps[0].status).toBe('done')
    expect(retry.result.media).toMatchObject({ kind: 'image', width: 800, height: 600 })

    // через 48 часов личное стирается и в Supabase
    await new Promise((r) => setTimeout(r, 50))
    const r = await cleanup(second.store, Date.now() + 72 * 3_600_000, 48)
    expect(r).toMatchObject({ uploads: 1, jobs: 2 })
    expect(r.remote).toBe(3)
    expect(fake.files.size).toBe(0)
    await second.store.flush()
    expect(fake.state.get('main/uploads')).toEqual([])
    expect(fake.calls.some((c) => c.startsWith('DELETE /storage/v1/object/server-files'))).toBe(true)
  }, 60_000)

  it('marks jobs cut by a restart as failed and writes that back', async () => {
    const fake = fakeSupabase()
    const now = new Date().toISOString()
    fake.state.set('main/jobs', [{ id: 'j1', kind: 'closet_scan', status: 'running', progress: '', percent: 0.5, steps: [], error: null, errorCode: null, result: {}, sample: null, createdAt: now, updatedAt: now }])
    fake.state.set('main/unknown', { junk: true })
    const { store } = await boot(fake.supabase)
    expect(store.job('j1')?.status).toBe('failed')
    await store.flush()
    expect((fake.state.get('main/jobs') as Job[])[0].errorCode).toBe('internal')
  })

  it('retries a failed state write', async () => {
    const fake = fakeSupabase()
    let fail = 1
    const flaky = new Supabase('https://test.supabase.co', 'sb_secret_test', (async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST' && String(input).includes('/rest/v1/') && fail-- > 0) return new Response('busy', { status: 503 })
      return (fake.supabase as unknown as { fetchImpl: typeof fetch }).fetchImpl(input, init)
    }) as typeof fetch)
    const logs: string[] = []
    const store = await Store.open(mkdtempSync(join(dir, 'data-')), flaky, (m) => logs.push(m))
    store.setWatch([])
    await store.flush()
    expect(logs[0]).toMatch(/не записалось/)
    expect(fake.state.has('main/watch')).toBe(false)
    await store.flush()
    expect(fake.state.get('main/watch')).toEqual([])
  })
})
