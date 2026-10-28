import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { cleanup } from '../src/cleanup'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { Store } from '../src/store'
import { PriceWatch } from '../src/watch'

function setup() {
  const store = new Store(mkdtempSync(join(tmpdir(), 'twin-state-')))
  const meta = new MetaApi('')
  const jobs = new Jobs(store, meta, join(tmpdir(), 'no-samples'), () => {})
  return { store, app: createApp({ store, jobs, meta, watch: new PriceWatch(store, meta, PriceWatch.jobSearch(jobs, meta)), log: () => {} }) }
}

const PC = { 'x-twin-device': 'd-0123456789abcdef0123456789abcdef' }
const OTHER = { 'x-twin-device': 'd-ffffffffffffffffffffffffffffffff' }
const put = (app: ReturnType<typeof setup>['app'], headers: Record<string, string>, body: unknown) =>
  app.request('/state/closet', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })

describe('closet state shared by the computer and the phone', () => {
  it('keeps the newest state per device and never lets an older one overwrite it', async () => {
    const { app } = setup()
    expect((await app.request('/state/closet')).status).toBe(400)
    expect((await app.request('/state/Bad-Name', { headers: PC })).status).toBe(400)
    expect(await (await app.request('/state/closet', { headers: PC })).json()).toEqual({ updatedAt: 0, data: {} })

    const t = Date.now() - 10_000
    expect(await (await put(app, PC, { updatedAt: t, data: { closet: ['a'] } })).json()).toEqual({ updatedAt: t, data: { closet: ['a'] } })
    // телефон, подключённый по QR, шлёт новее — заменяет
    await put(app, PC, { updatedAt: t + 5000, data: { closet: ['a', 'b'] } })
    // запоздавшая старая запись с компьютера не затирает новую и получает в ответ свежую
    expect(await (await put(app, PC, { updatedAt: t + 1000, data: { closet: [] } })).json()).toEqual({ updatedAt: t + 5000, data: { closet: ['a', 'b'] } })
    expect((await (await app.request('/state/closet', { headers: PC })).json()).data).toEqual({ closet: ['a', 'b'] })
    // у другого устройства — своё, у другого раздела — тоже
    expect(await (await app.request('/state/wishlist', { headers: PC })).json()).toEqual({ updatedAt: 0, data: {} })
    expect(await (await app.request('/state/closet', { headers: OTHER })).json()).toEqual({ updatedAt: 0, data: {} })
  })

  it('pulls a time from the future back to the server clock', async () => {
    const { app } = setup()
    const r = (await (await put(app, PC, { updatedAt: Date.now() + 3_600_000, data: {} })).json()) as { updatedAt: number }
    expect(r.updatedAt).toBeLessThanOrEqual(Date.now())
  })

  it('refuses bad and oversized bodies', async () => {
    const { app } = setup()
    expect((await put(app, PC, 'not json')).status).toBe(400)
    expect((await put(app, PC, { updatedAt: 'now', data: {} })).status).toBe(400)
    expect((await put(app, PC, { updatedAt: 1, data: [1] })).status).toBe(400)
    expect((await put(app, PC, { updatedAt: 1, data: { big: 'x'.repeat(300 * 1024) } })).status).toBe(413)
  })

  it('forgets devices untouched for a week', async () => {
    const { app, store } = setup()
    await put(app, PC, { updatedAt: Date.now() - 8 * 86_400_000, data: { old: true } })
    await put(app, OTHER, { updatedAt: Date.now(), data: { fresh: true } })
    expect((await cleanup(store)).devices).toBe(1)
    expect(store.device(`${PC['x-twin-device']}/closet`)).toBeUndefined()
    expect(store.device(`${OTHER['x-twin-device']}/closet`)?.data).toEqual({ fresh: true })
  })
})
