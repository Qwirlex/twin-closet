import type { Job, WatchItem } from '@twin/shared'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { Store } from '../src/store'
import { applyPrice, PriceWatch } from '../src/watch'

function setup() {
  const store = new Store(mkdtempSync(join(tmpdir(), 'twin-watch-')))
  const meta = new MetaApi('')
  const jobs = new Jobs(store, meta, join(tmpdir(), 'no-samples'))
  const watch = new PriceWatch(store, jobs, meta)
  return { store, watch, app: createApp({ store, jobs, meta, watch }) }
}

const item: WatchItem = { id: 'w1', name: 'Wide-leg jeans', storeId: 'zara', ref: '1234/567/800', url: null, price: 39.95, currency: 'EUR', country: 'IE', lastPrice: null, onSale: false, checkedAt: null }
const hit = (price: number | null, currency = 'EUR') => ({ title: 'Wide-leg jeans', url: 'https://www.zara.com/ie/en/p1', price, currency, snippet: '' })

describe('price watch', () => {
  it('marks a sale only when the price drops in the same currency', () => {
    const now = new Date('2026-10-28T09:00:00Z')
    expect(applyPrice(item, hit(29.95), now)).toMatchObject({ lastPrice: 29.95, onSale: true, url: 'https://www.zara.com/ie/en/p1', checkedAt: now.toISOString() })
    expect(applyPrice(item, hit(39.95), now).onSale).toBe(false)
    expect(applyPrice(item, hit(25, 'GBP'), now).onSale).toBe(false)
    expect(applyPrice(item, null, now)).toMatchObject({ lastPrice: null, onSale: false, checkedAt: now.toISOString() })
  })

  it('keeps only live stores and remembers earlier checks when the wishlist changes', async () => {
    const { app, store } = setup()
    const put = (items: object[]) => app.request('/watch', { method: 'PUT', body: JSON.stringify({ items }), headers: { 'content-type': 'application/json' } })
    const mango = { ...item, id: 'w2', storeId: 'mango' }
    expect((await (await put([item, mango])).json()).items.map((i: WatchItem) => i.id)).toEqual(['w1'])
    store.setWatch(store.watch().map((w) => ({ ...w, lastPrice: 29.95, onSale: true, checkedAt: 'x' })))
    await put([{ ...item, name: 'Wide-leg jeans, light' }])
    const { items } = (await (await app.request('/watch')).json()) as { items: WatchItem[] }
    expect(items[0]).toMatchObject({ name: 'Wide-leg jeans, light', lastPrice: 29.95, onSale: true })
  })

  it('without the Meta key the daily check is skipped', async () => {
    const { watch } = setup()
    watch.put([item])
    expect(await watch.checkAll()).toEqual({ checked: 0, skipped: 'no_key' })
  })
})

describe('product lookup', () => {
  const start = (app: ReturnType<typeof setup>['app'], lookup: object) => app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'product_lookup', lookup }), headers: { 'content-type': 'application/json' } })

  it('searches live stores with Muse Spark and waits for the key', async () => {
    const { app, store } = setup()
    const job = (await (await start(app, { storeId: 'zara', ref: '1234/567/800', country: 'IE' })).json()) as Job
    const jobs = new Jobs(store, new MetaApi(''), '')
    const done = await jobs.wait(job.id)
    expect(done.errorCode).toBe('no_key')
    expect(done.steps.map((s) => s.model)).toEqual(['Muse Spark', 'Muse Spark'])
  })

  it('says other stores are coming soon', async () => {
    const { app } = setup()
    const res = await start(app, { storeId: 'mango', query: 'linen shirt', country: 'IE' })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/coming soon/)
  })
})
