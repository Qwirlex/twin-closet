import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Jobs } from '../src/jobs'
import { Limits, limitsFromEnv } from '../src/limits'
import { MetaApi } from '../src/meta'
import { Store } from '../src/store'
import { PriceWatch } from '../src/watch'

describe('demo limits', () => {
  it('counts per address in a sliding window and says when to retry', () => {
    let now = 0
    const l = new Limits({ uploadsPerHour: 2, jobsPerDay: 1, jobsPerDayTotal: 2 }, () => now)
    l.record('a', 'upload')
    l.record('a', 'upload')
    expect(l.check('a', 'upload')).toMatchObject({ ok: false, retryAfter: 3600 })
    expect(l.check('b', 'upload').ok).toBe(true)
    now = 60 * 60 * 1000 + 1
    expect(l.check('a', 'upload').ok).toBe(true)

    l.record('a', 'job')
    expect(l.check('a', 'job').ok).toBe(false)
    l.record('b', 'job')
    // общий потолок на сервер — даже для нового адреса
    expect(l.check('c', 'job')).toMatchObject({ ok: false })
    expect(l.check('c', 'job').message).toMatch(/budget/)
  })

  it('reads limits from the environment with safe defaults', () => {
    expect(limitsFromEnv({})).toEqual({ uploadsPerHour: 30, jobsPerDay: 40, jobsPerDayTotal: 600 })
    expect(limitsFromEnv({ LIMIT_JOBS_PER_DAY: '5', LIMIT_UPLOADS_PER_HOUR: 'x' })).toMatchObject({ jobsPerDay: 5, uploadsPerHour: 30 })
  })

  it('the API answers 429 over the limit; a cached sample is free', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'twin-limits-'))
    const samples = join(dir, 'samples')
    mkdirSync(samples)
    writeFileSync(join(samples, 'item.jpg'), 'x')
    const store = new Store(join(dir, 'data'))
    const meta = new MetaApi('')
    const jobs = new Jobs(store, meta, samples)
    const app = createApp({ store, jobs, meta, watch: new PriceWatch(store, meta, PriceWatch.jobSearch(jobs, meta)), limits: new Limits({ uploadsPerHour: 1, jobsPerDay: 1, jobsPerDayTotal: 100 }) })
    const headers = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' }

    const form = () => {
      const f = new FormData()
      f.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' }))
      return f
    }
    expect((await app.request('/uploads', { method: 'POST', body: form(), headers: { 'x-forwarded-for': '203.0.113.7' } })).status).toBe(201)
    const second = await app.request('/uploads', { method: 'POST', body: form(), headers: { 'x-forwarded-for': '203.0.113.7' } })
    expect(second.status).toBe(429)
    expect(second.headers.get('retry-after')).toBeTruthy()

    // готовый результат по образцу из кэша не тратит лимит
    const now = new Date().toISOString()
    store.addJob({ id: 'cached', kind: 'import_item', status: 'done', progress: 'Done', percent: 1, steps: [], error: null, errorCode: null, result: {}, sample: 'item', createdAt: now, updatedAt: now })
    for (let i = 0; i < 3; i++) expect((await app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'import_item', sample: 'item' }), headers })).status).toBe(201)
    expect((await app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'product_lookup', lookup: { storeId: 'zara', ref: '1234/567/800', country: 'IE' } }), headers })).status).toBe(201)
    const over = await app.request('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'product_lookup', lookup: { storeId: 'zara', ref: '1234/567/800', country: 'IE' } }), headers })
    expect(over.status).toBe(429)
    expect((await over.json()).code).toBe('limit')
  })
})
