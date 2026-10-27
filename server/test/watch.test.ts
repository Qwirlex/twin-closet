import type { Job, ProductHit, WatchItem } from '@twin/shared'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { Store } from '../src/store'
import { applyCheck, blackFriday, dueForCheck, lowest30, PriceWatch, saleSeason, sameItem, type Search } from '../src/watch'

const HOUR = 3_600_000
const DEV = { 'x-twin-device': 'device-one' }
const item: WatchItem = {
  id: 'w1', name: 'Wide-leg jeans', storeId: 'zara', ref: '1234/567/800', url: null, price: 39.95, currency: 'EUR', country: 'IE',
  targetPrice: null, lastPrice: null, onSale: false, hitTarget: false, pendingPrice: null, lowest30: null, source: null, checkedAt: null
}
const hit = (price: number | null, over: Partial<ProductHit> = {}): ProductHit => ({ title: 'WIDE-LEG JEANS', url: 'https://www.zara.com/ie/en/wide-leg-jeans-p01234567.html', price, currency: 'EUR', snippet: 'Ref. 1234/567/800', ...over })
const at = (iso: string) => new Date(iso)

function setup(search?: Partial<Search>, key = '') {
  const store = new Store(mkdtempSync(join(tmpdir(), 'twin-watch-')))
  const meta = new MetaApi(key)
  const jobs = new Jobs(store, meta, join(tmpdir(), 'no-samples'))
  const s: Search = { product: async () => null, storeSale: async () => ({ onSale: false, source: null }), ...search }
  const watch = new PriceWatch(store, meta, s)
  return { store, watch, jobs, app: createApp({ store, jobs, meta, watch }) }
}

describe('a price drop counts only when it is real', () => {
  it('needs two checks with the same lower price', () => {
    const first = applyCheck(item, hit(29.95), [], at('2026-12-27T09:00:00Z'))
    expect(first.item).toMatchObject({ onSale: false, pendingPrice: 29.95, lastPrice: null })
    expect(first.point?.price).toBe(29.95)
    const second = applyCheck(first.item, hit(29.95), [first.point!], at('2026-12-27T10:00:00Z'))
    expect(second.item).toMatchObject({ onSale: true, pendingPrice: null, lastPrice: 29.95, lowest30: 29.95, source: hit(1).url })
  })

  it('a different second price restarts the wait; a price back up ends the sale', () => {
    const a = applyCheck(item, hit(29.95), []).item
    const b = applyCheck(a, hit(25.95), []).item
    expect(b).toMatchObject({ onSale: false, pendingPrice: 25.95 })
    const sale = { ...item, onSale: true, lastPrice: 29.95 }
    expect(applyCheck(sale, hit(39.95), []).item).toMatchObject({ onSale: false, lastPrice: 39.95, pendingPrice: null })
  })

  it('ignores other sites, other currencies and other pieces', () => {
    expect(applyCheck(item, hit(19.95, { url: 'https://deals.example.com/zara-jeans' }), []).point).toBeNull()
    expect(applyCheck(item, hit(19.95, { currency: 'GBP' }), []).point).toBeNull()
    expect(applyCheck(item, hit(19.95, { url: 'https://www.zara.com/ie/en/other-p09999999.html', snippet: 'Ref. 9999/999/800' }), []).point).toBeNull()
    expect(sameItem({ ...item, ref: null }, hit(1))).toBe(true)
    expect(sameItem({ ...item, ref: null, name: 'Linen shirt' }, hit(1))).toBe(false)
  })

  it('tells when the price reaches the target, even without a drop below the saved price', () => {
    const withTarget = { ...item, price: null, targetPrice: 30 }
    const a = applyCheck(withTarget, hit(29.5), []).item
    expect(applyCheck(a, hit(29.5), []).item).toMatchObject({ hitTarget: true, onSale: false })
  })

  it('lowest price over 30 days', () => {
    const pts = [29.95, 35, 25].map((price, i) => ({ itemId: 'w1', price, currency: 'EUR', url: 'u', checkedAt: new Date(Date.UTC(2026, 9, 1 + i * 20)).toISOString() }))
    expect(lowest30(pts, at('2026-11-15T00:00:00Z'))).toBe(25)
    expect(lowest30(pts, at('2026-12-31T00:00:00Z'))).toBeNull()
  })
})

describe('how often to check', () => {
  it('knows the usual sale seasons', () => {
    expect(blackFriday(2026).toISOString().slice(0, 10)).toBe('2026-11-27')
    expect(saleSeason(at('2026-11-25T12:00:00Z'))).toBe(true)
    expect(saleSeason(at('2026-12-26T12:00:00Z'))).toBe(true)
    expect(saleSeason(at('2027-07-10T12:00:00Z'))).toBe(true)
    expect(saleSeason(at('2026-10-28T12:00:00Z'))).toBe(false)
  })

  it('weekly out of season, daily in a sale, an hour after a first drop', () => {
    const oct = at('2026-10-28T12:00:00Z')
    const twoDays = { ...item, checkedAt: new Date(oct.getTime() - 48 * HOUR).toISOString() }
    expect(dueForCheck(twoDays, undefined, oct)).toBe(false)
    expect(dueForCheck(twoDays, { storeId: 'zara', country: 'IE', onSale: true, source: null, checkedAt: oct.toISOString() }, oct)).toBe(true)
    expect(dueForCheck({ ...item, checkedAt: new Date(oct.getTime() - 8 * 24 * HOUR).toISOString() }, undefined, oct)).toBe(true)
    expect(dueForCheck({ ...item, pendingPrice: 29.95, checkedAt: new Date(oct.getTime() - 61 * 60_000).toISOString() }, undefined, oct)).toBe(true)
    expect(dueForCheck(item, undefined, oct)).toBe(true)
  })
})

describe('price watch on the server', () => {
  it('keeps only live stores, remembers checks and accepts a target price', async () => {
    const { app, store } = setup()
    const put = (items: object[]) => app.request('/watch', { method: 'PUT', body: JSON.stringify({ items }), headers: { 'content-type': 'application/json', ...DEV } })
    const mango = { ...item, id: 'w2', storeId: 'mango' }
    expect((await (await put([item, mango])).json()).items.map((i: WatchItem) => i.id)).toEqual(['w1'])
    store.setWatch(store.watch().map((w) => ({ ...w, lastPrice: 29.95, onSale: true, checkedAt: 'x' })))
    await put([{ ...item, name: 'Wide-leg jeans, light', targetPrice: 30 }])
    const { items } = (await (await app.request('/watch', { headers: DEV })).json()) as { items: WatchItem[] }
    expect(items[0]).toMatchObject({ name: 'Wide-leg jeans, light', lastPrice: 29.95, onSale: true, targetPrice: 30, hitTarget: true })
  })

  it('every device has its own wishlist; a request without a device id is refused', async () => {
    const { app } = setup()
    const put = (device: string, items: object[]) => app.request('/watch', { method: 'PUT', body: JSON.stringify({ items }), headers: { 'content-type': 'application/json', 'x-twin-device': device } })
    await put('device-one', [item])
    await put('device-two', [{ ...item, name: 'Other jeans' }])
    await put('device-two', [{ ...item, name: 'Other jeans' }, { ...item, id: 'w9', name: 'Coat' }])
    const one = (await (await app.request('/watch', { headers: { 'x-twin-device': 'device-one' } })).json()) as { items: WatchItem[] }
    const two = (await (await app.request('/watch', { headers: { 'x-twin-device': 'device-two' } })).json()) as { items: WatchItem[] }
    expect(one.items.map((i) => i.name)).toEqual(['Wide-leg jeans'])
    expect(two.items.map((i) => i.name)).toEqual(['Other jeans', 'Coat'])
    expect(JSON.stringify(one)).not.toContain('owner')
    expect((await app.request('/watch')).status).toBe(400)
    expect((await app.request('/watch', { headers: { 'x-twin-device': '../x' } })).status).toBe(400)
  })

  it('without the Meta key nothing is searched', async () => {
    const { watch } = setup({ product: async () => hit(1) })
    watch.put('device-one', [item])
    expect(await watch.tick()).toEqual({ checked: 0, sales: 0, skipped: 'no_key' })
  })

  it('a full pass: store sale first, then items that are due, confirmed an hour later', async () => {
    let price = 29.95
    const { watch, app } = setup({ product: async () => hit(price), storeSale: async () => ({ onSale: true, source: 'https://www.zara.com/ie/' }) }, 'test-key')
    watch.put('device-one', [item])
    const t0 = at('2026-12-27T09:00:00Z')
    expect(await watch.tick(t0)).toEqual({ checked: 1, sales: 1 })
    expect(watch.list('device-one')[0]).toMatchObject({ pendingPrice: 29.95, onSale: false })
    expect(await watch.tick(new Date(t0.getTime() + 30 * 60_000))).toEqual({ checked: 0, sales: 0 })
    await watch.tick(new Date(t0.getTime() + HOUR))
    expect(watch.list('device-one')[0]).toMatchObject({ onSale: true, lastPrice: 29.95 })
    const { points } = await (await app.request('/watch/w1/history', { headers: DEV })).json()
    expect(points).toHaveLength(2)
    price = 39.95
    await watch.tick(new Date(t0.getTime() + 25 * HOUR))
    expect(watch.list('device-one')[0]).toMatchObject({ onSale: false, lastPrice: 39.95 })
  })
})

describe('product lookup', () => {
  const start = (app: ReturnType<typeof setup>['app'], lookup: object) => app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'product_lookup', lookup }), headers: { 'content-type': 'application/json' } })

  it('searches live stores with Muse Spark and waits for the key', async () => {
    const { app, jobs } = setup()
    const job = (await (await start(app, { storeId: 'zara', ref: '1234/567/800', country: 'IE' })).json()) as Job
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
