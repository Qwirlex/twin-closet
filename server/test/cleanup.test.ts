import { existsSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanup, retainHours } from '../src/cleanup'
import { Store } from '../src/store'

describe('privacy cleanup', () => {
  it('removes old uploads, job files and records but keeps cached samples', async () => {
    const store = new Store(mkdtempSync(join(tmpdir(), 'twin-clean-')))
    const now = Date.parse('2026-10-30T12:00:00Z')
    const old = new Date(now - 72 * 3_600_000).toISOString()
    const fresh = new Date(now - 3_600_000).toISOString()
    const job = (id: string, createdAt: string, sample: 'closet' | null) => ({ id, kind: 'closet_scan' as const, status: 'done' as const, progress: '', percent: 1, steps: [], error: null, errorCode: null, result: {}, sample, createdAt, updatedAt: createdAt })
    store.addUpload({ id: 'u-old', kind: 'image', name: 'a.jpg', mime: 'image/jpeg', size: 1, url: '/files/u-old.jpg', createdAt: old })
    store.addUpload({ id: 'u-new', kind: 'image', name: 'b.jpg', mime: 'image/jpeg', size: 1, url: '/files/u-new.jpg', createdAt: fresh })
    store.addJob(job('j-old', old, null))
    store.addJob(job('j-sample', old, 'closet'))
    for (const f of ['u-old.jpg', 'u-new.jpg', 'j-old.mp4', 'j-old-k0.jpg', 'j-sample.mp4', 'j-sample-k0.jpg', 'stray.jpg']) writeFileSync(join(store.files, f), 'x')
    const t = (now - 72 * 3_600_000) / 1000
    utimesSync(join(store.files, 'stray.jpg'), t, t)

    expect(await cleanup(store, now, 48)).toEqual({ files: 4, remote: 0, uploads: 1, jobs: 1, devices: 0 })
    expect(existsSync(join(store.files, 'u-new.jpg'))).toBe(true)
    expect(existsSync(join(store.files, 'j-sample-k0.jpg'))).toBe(true)
    expect(existsSync(join(store.files, 'u-old.jpg'))).toBe(false)
    expect(existsSync(join(store.files, 'j-old-k0.jpg'))).toBe(false)
    expect(existsSync(join(store.files, 'stray.jpg'))).toBe(false)
    expect(store.jobs().map((j) => j.id)).toEqual(['j-sample'])
    expect(retainHours({ RETAIN_HOURS: '12' })).toBe(12)
    expect(retainHours({})).toBe(48)
  })
})
