// Выжимка трендов по стране (docs/spec-trends.md): раз в неделю Muse Spark с веб-поиском, ответ — сразу из кэша.
// Без ключа или при ошибке модели — CURATED_TRENDS из shared, честно с source: 'curated'
import { CURATED_TRENDS, type TrendDigest } from '@twin/shared'
import type { MetaApi } from './meta'
import { runTask, text, trendDigest } from './models/spark'
import type { Store } from './store'

const WEEK = 7 * 86_400_000
/** После неудачи модель не дёргаем снова раньше, чем через час */
const RETRY_AFTER = 3_600_000

export type FetchDigest = (country: string) => Promise<TrendDigest>

export class Trends {
  private readonly inflight = new Map<string, Promise<void>>()
  private readonly failedAt = new Map<string, number>()

  constructor(
    private readonly store: Store,
    private readonly fetchDigest: FetchDigest | null,
    private readonly log: (m: string) => void = console.log,
    private readonly now: () => number = Date.now
  ) {}

  /** Живая выжимка от Muse Spark по стране (веб-поиск с её регионом) */
  static spark(meta: MetaApi): FetchDigest {
    return async (country) => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await runTask(meta, trendDigest, [text(`Country: ${country}. Today: ${today}.`)], { webSearchCountry: country })
      return data
    }
  }

  /** Выжимка для страны сразу; устаревшую обновляет в фоне (одна на страну за раз) */
  get(country: string): TrendDigest {
    const cached = this.store.trends(country)
    const fresh = cached && this.now() - Date.parse(cached.checkedAt) < WEEK
    if (!fresh) this.refresh(country)
    return cached?.digest ?? CURATED_TRENDS
  }

  /** Дождаться фонового обновления (для тестов и прогрева) */
  settled(country: string): Promise<void> {
    return this.inflight.get(country) ?? Promise.resolve()
  }

  private refresh(country: string): void {
    if (!this.fetchDigest || this.inflight.has(country)) return
    const failed = this.failedAt.get(country)
    if (failed && this.now() - failed < RETRY_AFTER) return
    const run = this.fetchDigest(country)
      .then((digest) => {
        this.store.setTrends(country, digest, new Date(this.now()).toISOString())
        this.failedAt.delete(country)
        this.log(`trends ${country}: ${digest.trends.length} from Muse Spark`)
      })
      .catch((e: unknown) => {
        this.failedAt.set(country, this.now())
        this.log(`trends ${country}: ${e instanceof Error ? e.message : String(e)} — curated stays`)
      })
      .finally(() => this.inflight.delete(country))
    this.inflight.set(country, run)
  }
}

/** Страна из запроса: две латинские буквы, иначе Ирландия */
export function trendCountry(raw: string | undefined): string {
  const cc = (raw ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(cc) ? cc : 'IE'
}
