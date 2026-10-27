// Слежка за ценой вещей из вишлиста: раз в сутки ищем вещь веб-поиском Muse Spark и сравниваем цену.
// Сайты и API магазинов напрямую не трогаем (docs/spec-stores-wishlist.md, «Откуда данные»).
import { LIVE_STORE_IDS, type ProductHit, type WatchItem } from '@twin/shared'
import type { Jobs } from './jobs'
import type { MetaApi } from './meta'
import type { Store } from './store'

/** Что присылает приложение: вещь вишлиста без результатов проверки */
export type WatchInput = Pick<WatchItem, 'id' | 'name' | 'storeId' | 'ref' | 'url' | 'price' | 'currency' | 'country'>

export const DAY = 24 * 60 * 60 * 1000

/** Новая цена после проверки. Скидка — цена ниже той, что была при добавлении в вишлист */
export function applyPrice(item: WatchItem, hit: ProductHit | null, now = new Date()): WatchItem {
  if (!hit || hit.price === null) return { ...item, checkedAt: now.toISOString() }
  const onSale = item.price !== null && (!item.currency || !hit.currency || item.currency === hit.currency) && hit.price < item.price - 0.005
  return { ...item, lastPrice: hit.price, onSale, url: item.url ?? hit.url, checkedAt: now.toISOString() }
}

export class PriceWatch {
  constructor(
    private readonly store: Store,
    private readonly jobs: Jobs,
    private readonly meta: MetaApi
  ) {}

  list(): WatchItem[] {
    return this.store.watch()
  }

  /** Заменяет список вишлиста. Берём только живые магазины и вещи, которые есть чем искать; прошлые проверки сохраняются */
  put(items: WatchInput[]): WatchItem[] {
    const prev = new Map(this.store.watch().map((w) => [w.id, w]))
    const next = items
      .filter((i) => (LIVE_STORE_IDS as readonly string[]).includes(i.storeId) && (i.ref || i.url || i.name))
      .slice(0, 200)
      .map((i): WatchItem => {
        const old = prev.get(i.id)
        return { ...i, lastPrice: old?.lastPrice ?? null, onSale: old?.onSale ?? false, checkedAt: old?.checkedAt ?? null }
      })
    this.store.setWatch(next)
    return next
  }

  /** Проверка всех вещей. Без ключа Meta — пропускаем: искать нечем */
  async checkAll(): Promise<{ checked: number; skipped?: 'no_key' }> {
    if (!this.meta.configured) return { checked: 0, skipped: 'no_key' }
    let checked = 0
    for (const item of this.store.watch()) {
      const job = this.jobs.start('product_lookup', { lookup: { storeId: item.storeId, ref: item.ref ?? undefined, query: item.ref ? undefined : item.name, country: item.country } })
      const done = await this.jobs.wait(job.id)
      const hit = done.status === 'done' ? (done.result.products?.[0] ?? null) : null
      this.store.setWatch(this.store.watch().map((w) => (w.id === item.id ? applyPrice(w, hit) : w)))
      checked++
    }
    return { checked }
  }

  /** Раз в сутки и через минуту после запуска */
  schedule(log: (msg: string) => void = console.log): () => void {
    const run = () =>
      this.checkAll()
        .then((r) => log(r.skipped ? 'Цены вишлиста: пропуск — нет ключа Meta' : `Цены вишлиста: проверено ${r.checked}`))
        .catch((e) => log(`Цены вишлиста: ошибка ${e instanceof Error ? e.message : e}`))
    const first = setTimeout(run, 60_000)
    const daily = setInterval(run, DAY)
    return () => {
      clearTimeout(first)
      clearInterval(daily)
    }
  }
}
