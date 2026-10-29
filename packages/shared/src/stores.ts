// Живые магазины (docs/spec-online-stores.md): поиск вещи, цена и слежка через веб-поиск Muse Spark.
// Один источник правды для сервера и приложения: имена, все домены, тип магазина, пометка о размерах, номер товара в ссылке

export const LIVE_STORE_IDS = ['zara', 'bershka', 'pull-and-bear', 'asos', 'zalando', 'h-and-m', 'shein', 'aliexpress', 'temu'] as const
export type LiveStoreId = (typeof LIVE_STORE_IDS)[number]

/** brand — свой бренд; multibrand — много брендов; marketplace — много продавцов одной вещи */
export type StoreType = 'brand' | 'multibrand' | 'marketplace'

export interface LiveStore {
  id: LiveStoreId
  name: string
  /** первый — главный (для подсказок модели); дальше — страновые домены */
  domains: string[]
  type: StoreType
  /** что знать о размерах до покупки; null — особенностей нет */
  sizing: string | null
  /** номер товара в пути ссылки (первая группа); null — формат не проверен */
  productPath: RegExp | null
}

const ZALANDO = ['ie', 'co.uk', 'de', 'at', 'ch', 'fr', 'it', 'es', 'nl', 'be', 'pl', 'cz', 'sk', 'se', 'dk', 'fi', 'no', 'lu', 'hu', 'ro', 'hr', 'si', 'lt', 'lv', 'ee', 'com'].map((tld) => `zalando.${tld}`)
const CHEAP = 'Every seller has its own chart, often Asian sizing that runs one or two sizes small — check it in cm.'
const MANY_BRANDS = 'Many brands, each with its own size chart — check the chart of this brand.'

export const LIVE_STORES: Record<LiveStoreId, LiveStore> = {
  zara: { id: 'zara', name: 'Zara', domains: ['zara.com'], type: 'brand', sizing: null, productPath: /-p(\d{8})\.html/ },
  bershka: { id: 'bershka', name: 'Bershka', domains: ['bershka.com'], type: 'brand', sizing: null, productPath: null },
  'pull-and-bear': { id: 'pull-and-bear', name: 'Pull & Bear', domains: ['pullandbear.com'], type: 'brand', sizing: null, productPath: null },
  asos: { id: 'asos', name: 'ASOS', domains: ['asos.com'], type: 'multibrand', sizing: MANY_BRANDS, productPath: /\/prd\/(\d+)/ },
  zalando: { id: 'zalando', name: 'Zalando', domains: ZALANDO, type: 'multibrand', sizing: MANY_BRANDS, productPath: /-([a-z0-9]{9}-[a-z0-9]{3})\.html/i },
  'h-and-m': { id: 'h-and-m', name: 'H&M', domains: ['hm.com'], type: 'brand', sizing: null, productPath: /productpage\.(\d+)\.html/ },
  shein: { id: 'shein', name: 'Shein', domains: ['shein.com', 'shein.co.uk'], type: 'brand', sizing: 'Sizes often run small and change from item to item — compare the size chart in cm, not the letter.', productPath: /-p-(\d+)/ },
  aliexpress: { id: 'aliexpress', name: 'AliExpress', domains: ['aliexpress.com', 'aliexpress.us'], type: 'marketplace', sizing: CHEAP, productPath: /\/item\/(\d+)\.html/ },
  temu: { id: 'temu', name: 'Temu', domains: ['temu.com'], type: 'marketplace', sizing: CHEAP, productPath: /-g-(\d+)\.html/ }
}

/** Главный домен живого магазина (zara.com) */
export const LIVE_STORE_DOMAINS = Object.fromEntries(LIVE_STORE_IDS.map((id) => [id, LIVE_STORES[id].domains[0]])) as Record<LiveStoreId, string>

export const isLiveStore = (id: string | null | undefined): id is LiveStoreId => !!id && (LIVE_STORE_IDS as readonly string[]).includes(id)

/** Сам домен магазина или его поддомен (www2.hm.com, ie.shein.com); asos.com.evil.io — нет */
export function isStoreHost(storeId: string, host: string): boolean {
  if (!isLiveStore(storeId)) return false
  const h = host.toLowerCase().replace(/\.$/, '')
  return LIVE_STORES[storeId].domains.some((d) => h === d || h.endsWith(`.${d}`))
}

const parse = (url: string): URL | null => {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

/** Ссылка ведёт на сайт этого магазина */
export function isStorePage(url: string, storeId: string): boolean {
  const u = parse(url)
  return !!u && isStoreHost(storeId, u.hostname)
}

/** Магазин и номер товара из вставленной ссылки; не живой магазин — null */
export function storeOfUrl(url: string): { storeId: LiveStoreId; productId: string | null } | null {
  const u = parse(url)
  if (!u) return null
  const storeId = LIVE_STORE_IDS.find((id) => isStoreHost(id, u.hostname))
  if (!storeId) return null
  const pattern = LIVE_STORES[storeId].productPath
  const m = pattern ? u.pathname.match(pattern) : null
  const productId = m ? (storeId === 'zalando' ? m[1].toUpperCase() : m[1]) : null
  return { storeId, productId }
}
