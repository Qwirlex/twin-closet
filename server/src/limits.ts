// Лимиты для веб-версии судей: кредитов Meta $150 на всё — один человек не должен сжечь их за вечер.
// Считаем по адресу: загрузки в час, задачи моделей в сутки, плюс общий потолок задач в сутки на весь сервер.

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export interface LimitConfig {
  uploadsPerHour: number
  jobsPerDay: number
  jobsPerDayTotal: number
}

export function limitsFromEnv(env: Record<string, string | undefined> = process.env): LimitConfig {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)
  return { uploadsPerHour: n(env.LIMIT_UPLOADS_PER_HOUR, 30), jobsPerDay: n(env.LIMIT_JOBS_PER_DAY, 40), jobsPerDayTotal: n(env.LIMIT_JOBS_PER_DAY_TOTAL, 600) }
}

export type LimitKind = 'upload' | 'job'

export interface LimitCheck {
  ok: boolean
  /** через сколько секунд можно снова */
  retryAfter: number
  message: string | null
}

export class Limits {
  private readonly hits = new Map<string, number[]>()

  constructor(
    readonly config: LimitConfig,
    private readonly clock: () => number = Date.now
  ) {}

  private window(key: string, span: number): number[] {
    const now = this.clock()
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < span)
    this.hits.set(key, list)
    return list
  }

  /** Можно ли ещё одно действие (не записывает его) */
  check(ip: string, kind: LimitKind): LimitCheck {
    const now = this.clock()
    const wait = (list: number[], span: number) => Math.max(1, Math.ceil((list[0] + span - now) / 1000))
    if (kind === 'upload') {
      const list = this.window(`u:${ip}`, HOUR)
      if (list.length >= this.config.uploadsPerHour) return { ok: false, retryAfter: wait(list, HOUR), message: 'You have added a lot of files in the last hour. Try a sample, or come back a little later.' }
      return { ok: true, retryAfter: 0, message: null }
    }
    const total = this.window('j:*', DAY)
    if (total.length >= this.config.jobsPerDayTotal) return { ok: false, retryAfter: wait(total, DAY), message: 'The demo has used today’s model budget. The samples and the demo account still work.' }
    const mine = this.window(`j:${ip}`, DAY)
    if (mine.length >= this.config.jobsPerDay) return { ok: false, retryAfter: wait(mine, DAY), message: 'That is today’s limit for this demo. The samples and the demo account still work.' }
    return { ok: true, retryAfter: 0, message: null }
  }

  record(ip: string, kind: LimitKind): void {
    const now = this.clock()
    if (kind === 'upload') this.window(`u:${ip}`, HOUR).push(now)
    else {
      this.window(`j:${ip}`, DAY).push(now)
      this.window('j:*', DAY).push(now)
    }
  }
}
