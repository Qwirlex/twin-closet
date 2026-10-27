// Слежка за ценой вещей из вишлиста (docs/spec-stores-wishlist.md, «Скидки v2»).
// Цену берём только из веб-поиска Muse Spark и только со страниц того же магазина; сайты и API магазинов не трогаем.
// Экономия: раз в день спрашиваем «идёт ли распродажа» по магазину; вещи — каждый день только в распродажу, иначе раз в неделю.
import { LIVE_STORE_DOMAINS, LIVE_STORE_IDS, type PricePoint, type ProductHit, type StoreSale, type WatchItem } from '@twin/shared'
import { STORE_NAMES, type Jobs } from './jobs'
import { runTask, storeSale, text } from './models/spark'
import type { MetaApi } from './meta'
import type { Store } from './store'

/** Что присылает приложение: вещь вишлиста без результатов проверки */
export type WatchInput = Pick<WatchItem, 'id' | 'name' | 'storeId' | 'ref' | 'url' | 'price' | 'currency' | 'country'> & { targetPrice?: number | null }

const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR

/** Поиск, который делает Muse Spark. В тестах — подставной */
export interface Search {
  product(item: WatchItem): Promise<ProductHit | null>
  storeSale(storeId: string, country: string): Promise<{ onSale: boolean; source: string | null }>
}

const isLive = (id: string): id is (typeof LIVE_STORE_IDS)[number] => (LIVE_STORE_IDS as readonly string[]).includes(id)

/** Страница того же магазина (zara.com, www.zara.com/ie/en/…) */
export function sameStorePage(url: string, storeId: string): boolean {
  if (!isLive(storeId)) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    const domain = LIVE_STORE_DOMAINS[storeId]
    return host === domain || host.endsWith(`.${domain}`)
  } catch {
    return false
  }
}

const digits = (s: string) => s.replace(/\D/g, '')

/**
 * Та же ли это вещь. С артикулом — цифры REF (без последней группы-цвета) должны встретиться в ссылке или тексте;
 * со ссылкой — та же страница; иначе — все слова названия в заголовке.
 */
export function sameItem(item: WatchItem, hit: ProductHit): boolean {
  if (item.ref) {
    const groups = item.ref.split(/[^\d]+/).filter(Boolean)
    const core = digits(groups.slice(0, 2).join(''))
    return core.length >= 6 && digits(`${hit.url} ${hit.title} ${hit.snippet}`).includes(core)
  }
  if (item.url) {
    try {
      return new URL(item.url).pathname.replace(/\/$/, '') === new URL(hit.url).pathname.replace(/\/$/, '')
    } catch {
      return false
    }
  }
  const words = item.name.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
  return words.length > 0 && words.every((w) => hit.title.toLowerCase().includes(w))
}

export function lowest30(points: PricePoint[], now: Date): number | null {
  const recent = points.filter((p) => now.getTime() - Date.parse(p.checkedAt) <= 30 * DAY).map((p) => p.price)
  return recent.length ? Math.min(...recent) : null
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, a * 0.01)

/**
 * Одна проверка цены. Снижение показываем только после второй проверки с той же ценой,
 * чужие страницы, другая валюта и похожие (не те же) вещи не считаются.
 */
export function applyCheck(item: WatchItem, hit: ProductHit | null, history: PricePoint[], now = new Date()): { item: WatchItem; point: PricePoint | null } {
  const checkedAt = now.toISOString()
  const ok = hit && hit.price !== null && sameStorePage(hit.url, item.storeId) && (!item.currency || !hit.currency || item.currency === hit.currency) && sameItem(item, hit)
  if (!ok) return { item: { ...item, checkedAt }, point: null }
  const price = hit.price!
  const point: PricePoint = { itemId: item.id, price, currency: hit.currency ?? item.currency, url: hit.url, checkedAt }
  const low = lowest30([...history, point], now)
  const below = item.price !== null && price < item.price - 0.005
  const underTarget = item.targetPrice !== null && price <= item.targetPrice + 0.005
  const base = { ...item, url: item.url ?? hit.url, source: hit.url, lowest30: low, checkedAt }

  if (!below && !underTarget) return { item: { ...base, lastPrice: price, onSale: false, hitTarget: false, pendingPrice: null }, point }
  if (item.pendingPrice !== null && close(item.pendingPrice, price)) {
    return { item: { ...base, lastPrice: price, onSale: below, hitTarget: underTarget, pendingPrice: null }, point }
  }
  // первая проверка с новой ценой: подтвердим через час
  return { item: { ...base, pendingPrice: price }, point }
}

/** Пятница после четвёртого четверга ноября */
export function blackFriday(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1))
  const firstThu = 1 + ((4 - nov1.getUTCDay() + 7) % 7)
  return new Date(Date.UTC(year, 10, firstThu + 21 + 1))
}

/**
 * Обычные сезоны распродаж: неделя Black Friday, зимняя (с 23 декабря по январь), летняя (с 23 июня по июль).
 * Это только повод проверять чаще — сама распродажа подтверждается поиском «идёт ли распродажа».
 */
export function saleSeason(d: Date): boolean {
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const bf = blackFriday(d.getUTCFullYear()).getTime()
  if (d.getTime() >= bf - 3 * DAY && d.getTime() <= bf + 4 * DAY) return true
  if ((m === 11 && day >= 23) || m === 0) return true
  if ((m === 5 && day >= 23) || m === 6) return true
  return false
}

/** Пора ли проверять вещь: повтор через час после снижения; ежедневно в распродажу и за 3 дня до сезона; иначе раз в неделю */
export function dueForCheck(item: WatchItem, sale: StoreSale | undefined, now: Date): boolean {
  const since = item.checkedAt ? now.getTime() - Date.parse(item.checkedAt) : Infinity
  if (item.pendingPrice !== null) return since >= HOUR
  const hot = sale?.onSale || saleSeason(now) || saleSeason(new Date(now.getTime() + 3 * DAY))
  return since >= (hot ? 20 * HOUR : 7 * DAY)
}

export class PriceWatch {
  constructor(
    private readonly store: Store,
    private readonly meta: MetaApi,
    private readonly search: Search
  ) {}

  /** Поиск через задачу product_lookup (Muse Spark web search); «распродажа?» соберём вместе с ключом */
  static jobSearch(jobs: Jobs, meta: MetaApi): Search {
    return {
      async product(item) {
        const job = jobs.start('product_lookup', { lookup: { storeId: item.storeId, ref: item.ref ?? undefined, query: item.ref ? undefined : item.name, country: item.country } })
        const done = await jobs.wait(job.id)
        return done.status === 'done' ? (done.result.products?.[0] ?? null) : null
      },
      async storeSale(storeId, country) {
        const store = { name: STORE_NAMES[storeId] ?? storeId, domain: LIVE_STORE_DOMAINS[storeId as keyof typeof LIVE_STORE_DOMAINS] }
        const { data } = await runTask(meta, storeSale(store), [text(`Country: ${country}`)], { webSearchCountry: country })
        return { onSale: data.on_sale, source: data.source_url }
      }
    }
  }

  list(): WatchItem[] {
    return this.store.watch()
  }

  history(itemId: string): PricePoint[] {
    return this.store.prices(itemId)
  }

  sales(): StoreSale[] {
    return this.store.sales()
  }

  /** Заменяет список вишлиста. Берём только живые магазины; прошлые проверки сохраняются */
  put(items: WatchInput[]): WatchItem[] {
    const prev = new Map(this.store.watch().map((w) => [w.id, w]))
    const next = items
      .filter((i) => isLive(i.storeId) && (i.ref || i.url || i.name))
      .slice(0, 200)
      .map((i): WatchItem => {
        const old = prev.get(i.id)
        const targetPrice = typeof i.targetPrice === 'number' && i.targetPrice > 0 ? i.targetPrice : null
        return {
          ...i,
          targetPrice,
          lastPrice: old?.lastPrice ?? null,
          onSale: old?.onSale ?? false,
          // цель сменилась — пересчитаем по последней цене
          hitTarget: targetPrice !== null && old?.lastPrice != null ? old.lastPrice <= targetPrice + 0.005 : false,
          pendingPrice: old?.pendingPrice ?? null,
          lowest30: old?.lowest30 ?? null,
          source: old?.source ?? null,
          checkedAt: old?.checkedAt ?? null
        }
      })
    this.store.setWatch(next)
    return next
  }

  /** Один проход: распродажи по магазинам (раз в ~сутки), затем вещи, которым пора. Без ключа Meta — пропуск */
  async tick(now = new Date()): Promise<{ checked: number; sales: number; skipped?: 'no_key' }> {
    if (!this.meta.configured) return { checked: 0, sales: 0, skipped: 'no_key' }
    let sales = 0
    const pairs = [...new Set(this.store.watch().map((w) => `${w.storeId}|${w.country}`))].map((p) => p.split('|') as [string, string])
    for (const [storeId, country] of pairs) {
      const known = this.store.sales().find((s) => s.storeId === storeId && s.country === country)
      if (known && now.getTime() - Date.parse(known.checkedAt) < 20 * HOUR) continue
      try {
        const r = await this.search.storeSale(storeId, country)
        this.store.setSale({ storeId, country, onSale: r.onSale, source: r.source, checkedAt: now.toISOString() })
        sales++
      } catch {
        // не узнали — вещи проверятся по сезону
      }
    }
    let checked = 0
    for (const item of this.store.watch()) {
      const sale = this.store.sales().find((s) => s.storeId === item.storeId && s.country === item.country)
      if (!dueForCheck(item, sale, now)) continue
      const hit = await this.search.product(item).catch(() => null)
      const { item: next, point } = applyCheck(item, hit, this.store.prices(item.id), now)
      if (point) this.store.addPrice(point)
      this.store.setWatch(this.store.watch().map((w) => (w.id === item.id ? next : w)))
      checked++
    }
    return { checked, sales }
  }

  /** Раз в час: сам проход решает, кого проверять (повторы через час, распродажи, раз в неделю) */
  schedule(log: (msg: string) => void = console.log): () => void {
    let lastSkip = 0
    const run = () =>
      this.tick()
        .then((r) => {
          if (r.skipped) {
            if (Date.now() - lastSkip > DAY) log('Цены вишлиста: пропуск — нет ключа Meta')
            lastSkip = Date.now()
          } else if (r.checked || r.sales) log(`Цены вишлиста: магазинов ${r.sales}, вещей ${r.checked}`)
        })
        .catch((e) => log(`Цены вишлиста: ошибка ${e instanceof Error ? e.message : e}`))
    const first = setTimeout(run, 60_000)
    const hourly = setInterval(run, HOUR)
    return () => {
      clearTimeout(first)
      clearInterval(hourly)
    }
  }
}
