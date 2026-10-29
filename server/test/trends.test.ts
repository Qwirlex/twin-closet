import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanDigest, CURATED_TRENDS, liveDetail, profileFromVotes, STYLE_IDS, trendHits, trendPrompt, trendsFor, type TrendDigest } from '@twin/shared'
import { createApp } from '../src/app'
import { Jobs } from '../src/jobs'
import { MetaApi } from '../src/meta'
import { looksBrief, markPlain } from '../src/models/spark'
import { Store } from '../src/store'
import { trendCountry, Trends, type FetchDigest } from '../src/trends'
import { PriceWatch } from '../src/watch'

describe('curated trends', () => {
  it('has 12–16 trends with real styles, keywords and unique ids', () => {
    const t = CURATED_TRENDS.trends
    expect(t.length).toBeGreaterThanOrEqual(12)
    expect(t.length).toBeLessThanOrEqual(16)
    expect(new Set(t.map((x) => x.id)).size).toBe(t.length)
    for (const x of t) {
      expect(x.styles.length).toBeGreaterThan(0)
      for (const s of x.styles) expect(STYLE_IDS).toContain(s)
      expect(x.keywords.length).toBeGreaterThan(0)
      for (const k of x.keywords) expect(k).toBe(k.toLowerCase())
      expect(x.line.length).toBeGreaterThan(20)
    }
    expect(CURATED_TRENDS.source).toBe('curated')
    expect(CURATED_TRENDS.sources.length).toBeGreaterThanOrEqual(3)
  })
})

describe('cleanDigest', () => {
  it('keeps only valid trends from a model answer', () => {
    const d = cleanDigest({
      season: 'AW26',
      region: 'Ireland',
      trends: [
        { id: 'x', name: 'Barn jackets', kind: 'piece', line: 'A waxed barn jacket over a chunky knit, every day.', styles: ['workwear', 'nope'], keywords: ['Barn Jacket'], who: 'all' },
        { id: 'y', name: 'Bad', kind: 'mood', line: 'x', styles: [], keywords: [], who: 'all' }
      ],
      sources: [{ name: 'GQ', url: 'https://www.gq-magazine.co.uk/x' }, { name: 'bad', url: 'javascript:alert(1)' }]
    })
    expect(d?.trends).toHaveLength(1)
    expect(d?.trends[0].styles).toEqual(['workwear'])
    expect(d?.trends[0].keywords).toEqual(['barn jacket'])
    expect(d?.source).toBe('spark')
    expect(d?.sources).toEqual([{ name: 'GQ', url: 'https://www.gq-magazine.co.uk/x' }])
    expect(cleanDigest('rubbish')).toBeNull()
    expect(cleanDigest({ trends: [] })).toBeNull()
  })
})

describe('matching', () => {
  it('ranks trends for the person and drops avoided or other-wear ones', () => {
    const military = profileFromVotes({ military: 'love' })!
    expect(trendsFor(CURATED_TRENDS, military, 'men')[0].id).toBe('military-jackets')
    const avoidsWestern = { ...military, avoid: ['western' as const] }
    expect(trendsFor(CURATED_TRENDS, avoidsWestern, 'men').some((t) => t.styles.every((s) => s === 'western'))).toBe(false)
    expect(trendsFor(CURATED_TRENDS, military, 'men').some((t) => t.who === 'women')).toBe(false)
    // без профиля — все тренды по порядку выжимки
    expect(trendsFor(CURATED_TRENDS, null, 'all').map((t) => t.id)).toEqual(CURATED_TRENDS.trends.map((t) => t.id))
  })

  it('finds trends in closet pieces by whole words', () => {
    expect(trendHits('Olive bomber · Nylon · Relaxed', CURATED_TRENDS).map((t) => t.id)).toContain('military-jackets')
    expect(trendHits('Black hoodie · Cotton · Oversize', CURATED_TRENDS).map((t) => t.id)).toContain('hoods-and-scarves')
    expect(trendHits('Redwood candle', CURATED_TRENDS).map((t) => t.id)).not.toContain('red-accent')
    expect(trendHits('Grey tee · Cotton · Regular', CURATED_TRENDS)).toEqual([])
  })
})

describe('liveDetail', () => {
  const tee = { kind: 'top', title: 'White tee', color: 'white', material: 'cotton' } as const
  const jeans = { kind: 'bottom', title: 'Blue jeans', color: 'blue', material: 'denim' } as const
  const sneakers = { kind: 'shoes', title: 'White sneakers', color: 'white', material: 'canvas' } as const

  it('plain basics have none', () => {
    expect(liveDetail([tee, jeans, sneakers], CURATED_TRENDS)).toBeNull()
  })

  it('a trend piece, layers, a colour or a texture count', () => {
    expect(liveDetail([tee, jeans, sneakers, { kind: 'outerwear', title: 'Olive bomber', color: 'olive', material: 'nylon' }], CURATED_TRENDS)).toBe('Military jackets')
    expect(liveDetail([tee, jeans, sneakers, { kind: 'outerwear', title: 'Grey coat', color: 'grey', material: 'nylon' }], CURATED_TRENDS)).toBe('layers')
    expect(liveDetail([{ ...tee, color: 'forest green', title: 'Top' }, jeans, sneakers], CURATED_TRENDS)).toBe('colour accent')
    expect(liveDetail([tee, { ...jeans, title: 'Trousers', color: 'black', material: 'wool' }, sneakers], CURATED_TRENDS)).toBe('texture')
  })
})

describe('trendPrompt', () => {
  it('lists trends for the person and the never-force rule', () => {
    const p = trendPrompt(CURATED_TRENDS, profileFromVotes({ military: 'love' }), 'men')
    expect(p).toContain('Military jackets')
    expect(p).toMatch(/never force/i)
    expect(p.split('\n').filter((l) => l.startsWith('- ')).length).toBe(6)
  })
})

describe('weekly digest on the server', () => {
  const setup = (fetchDigest: FetchDigest | null, now = { t: Date.parse('2026-10-29T12:00:00Z') }) => {
    const store = new Store(mkdtempSync(join(tmpdir(), 'twin-trends-')))
    return { store, now, trends: new Trends(store, fetchDigest, () => {}, () => now.t) }
  }
  const spark: TrendDigest = { ...CURATED_TRENDS, source: 'spark', region: 'Ireland', trends: CURATED_TRENDS.trends.slice(0, 3) }

  it('without the key it is the curated digest', () => {
    const { trends } = setup(null)
    expect(trends.get('IE')).toBe(CURATED_TRENDS)
  })

  it('asks Muse Spark once a week per country and answers from the cache meanwhile', async () => {
    let calls = 0
    const { trends, now } = setup(async () => (calls++, spark))
    expect(trends.get('IE').source).toBe('curated')
    await trends.settled('IE')
    expect(trends.get('IE').source).toBe('spark')
    expect(trends.get('IE').region).toBe('Ireland')
    expect(calls).toBe(1)
    now.t += 8 * 86_400_000
    expect(trends.get('IE').source).toBe('spark')
    await trends.settled('IE')
    expect(calls).toBe(2)
  })

  it('a failed search keeps the curated digest and waits before trying again', async () => {
    let calls = 0
    const { trends, now } = setup(async () => {
      calls++
      throw new Error('quota')
    })
    trends.get('PL')
    await trends.settled('PL')
    trends.get('PL')
    await trends.settled('PL')
    expect(calls).toBe(1)
    now.t += 2 * 3_600_000
    expect(trends.get('PL')).toBe(CURATED_TRENDS)
    await trends.settled('PL')
    expect(calls).toBe(2)
  })

  it('GET /trends answers without the key, any country code is cleaned', async () => {
    const store = new Store(mkdtempSync(join(tmpdir(), 'twin-trends-app-')))
    const meta = new MetaApi('')
    const jobs = new Jobs(store, meta, join(tmpdir(), 'no-samples'), () => {})
    const app = createApp({ store, jobs, meta, watch: new PriceWatch(store, meta, PriceWatch.jobSearch(jobs, meta)), log: () => {} })
    const body = (await (await app.request('/trends?country=ie')).json()) as TrendDigest
    expect(body.source).toBe('curated')
    expect(body.trends.length).toBe(CURATED_TRENDS.trends.length)
    expect(trendCountry('<script>')).toBe('IE')
    expect(trendCountry('pl')).toBe('PL')
  })
})

describe('outfit brief and plain looks', () => {
  it('the brief carries their style and the trends for it', () => {
    const brief = looksBrief(profileFromVotes({ military: 'love' }), CURATED_TRENDS, 'men')
    expect(brief).toContain('Their style')
    expect(brief).toContain('Military jackets')
    expect(brief).toMatch(/no plain basics/i)
  })

  it('looks without a live detail are marked and go last', () => {
    const pieces = {
      tee: { kind: 'top', title: 'White tee', color: 'white', material: 'cotton' },
      jeans: { kind: 'bottom', title: 'Blue jeans', color: 'blue', material: 'denim' },
      sneakers: { kind: 'shoes', title: 'White sneakers', color: 'white', material: 'canvas' },
      bomber: { kind: 'outerwear', title: 'Olive bomber', color: 'olive', material: 'nylon' }
    }
    const looks = markPlain(
      [
        { title: 'Plain', item_ids: ['tee', 'jeans', 'sneakers'], note: '' },
        { title: 'Weekend', item_ids: ['bomber', 'tee', 'jeans', 'sneakers'], note: '' }
      ],
      pieces,
      CURATED_TRENDS
    )
    expect(looks.map((l) => [l.title, l.plain, l.detail])).toEqual([
      ['Weekend', false, 'Military jackets'],
      ['Plain', true, null]
    ])
  })
})
