// Muse Spark: все шаги, где модель смотрит и решает. Каждый шаг — промпт + JSON-схема (ответ по схеме гарантирован API).
// Схемы строгие: все поля обязательны, лишних нет, «нет значения» — null (так требует strict json_schema).
import { GARMENT_KINDS, type GarmentKind } from '@twin/shared'
import sharp from 'sharp'
import { citations, MODELS, outputText, type MetaApi, type ResponsesOutput } from '../meta'

export type Part = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string }

/** Картинка для модели: JPEG не больше 1280 по длинной стороне (~1500 входных токенов), data: URL */
export async function imagePart(input: string | Buffer, maxSide = 1280): Promise<Part> {
  const jpg = await sharp(input).rotate().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  return { type: 'input_image', image_url: `data:image/jpeg;base64,${jpg.toString('base64')}` }
}

export const text = (t: string): Part => ({ type: 'input_text', text: t })

type Schema = Record<string, unknown>
const str = { type: 'string' }
const strOrNull = { type: ['string', 'null'] }
const numOrNull = { type: ['number', 'null'] }
const int = { type: 'integer' }
const bool = { type: 'boolean' }
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const arr = (items: Schema): Schema => ({ type: 'array', items })
const kind = { type: 'string', enum: [...GARMENT_KINDS] }
/** Рамка в сетке 0–1000 от картинки, которую видела модель (docs/meta-api.md) */
const box = obj({ x_min: int, y_min: int, x_max: int, y_max: int })

export interface Box1000 {
  x_min: number
  y_min: number
  x_max: number
  y_max: number
}

/** Рамка 0–1000 → пиксели кадра (для подсказок SAM) */
export function boxToPixels(b: Box1000, width: number, height: number): { x1: number; y1: number; x2: number; y2: number } {
  const clamp = (v: number) => Math.max(0, Math.min(1000, v))
  return { x1: Math.round((clamp(b.x_min) / 1000) * width), y1: Math.round((clamp(b.y_min) / 1000) * height), x2: Math.round((clamp(b.x_max) / 1000) * width), y2: Math.round((clamp(b.y_max) / 1000) * height) }
}

/** Общие правила для всех шагов: про одежду, честно, без выдумок */
const BASE_RULES = `You are part of Twin Closet, an app that shows people new clothes on their real body together with clothes they already own.
Be literal and precise. Describe only what you can see. If something is not visible or not readable, use null instead of guessing.`

export interface Task<T> {
  name: string
  system: string
  schema: Schema
  /** рассуждение: ниже — для быстрых шагов (подписи), выше — для образов */
  effort: 'low' | 'medium' | 'high'
  parse?: (raw: unknown) => T
}

/** Тело запроса Responses API для шага (без вызова — удобно проверять в тестах) */
export function requestBody<T>(task: Task<T>, parts: Part[], opts: { webSearchCountry?: string } = {}): Record<string, unknown> {
  return {
    model: MODELS.spark,
    instructions: task.system,
    input: [{ role: 'user', content: parts }],
    // модель рассуждающая: меньше 4000 — ответ может оборваться пустым
    max_output_tokens: 8000,
    reasoning: { effort: task.effort },
    text: { format: { type: 'json_schema', name: task.name, schema: task.schema, strict: true } },
    ...(opts.webSearchCountry
      ? { tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: opts.webSearchCountry } }], include: ['web_search_call.results'] }
      : {})
  }
}

export async function runTask<T>(meta: MetaApi, task: Task<T>, parts: Part[], opts: { webSearchCountry?: string } = {}): Promise<{ data: T; raw: ResponsesOutput }> {
  const raw = await meta.responses(requestBody(task, parts, opts))
  const json = JSON.parse(outputText(raw)) as unknown
  return { data: task.parse ? task.parse(json) : (json as T), raw }
}

// ── Скан шкафа ─────────────────────────────────────────────────────────────

export interface DetectedGarment {
  label: string
  kind: GarmentKind
  /** номер ключевого кадра, где вещь видна лучше всего */
  frame: number
  box: Box1000
}

export const detectGarments: Task<{ garments: DetectedGarment[] }> = {
  name: 'closet_garments',
  effort: 'medium',
  system: `${BASE_RULES}
You get numbered key frames from one video of a person's closet (a rail of hangers or pieces held up one by one).
List every distinct clothing item, shoes included. One entry per physical item even if it appears in many frames.
For each item pick the frame where it is most visible, least covered and not cut off by the edge, and give its bounding box
on that frame in a 0–1000 grid (x_min, y_min, x_max, y_max from the top-left corner).
"label" is a short English noun phrase that also works as a segmentation prompt, e.g. "black hoodie", "white sneakers".
Ignore people, hands, hangers, the rail, boxes and bags that are not clothing. Return at most 40 items.`,
  schema: obj({ garments: arr(obj({ label: str, kind, frame: int, box })) })
}

export interface GarmentTags {
  title: string
  kind: GarmentKind
  color: string
  material: string | null
  fit: string | null
  pattern: string | null
  season: 'all' | 'summer' | 'winter' | 'spring_autumn'
}

export const tagGarment: Task<GarmentTags> = {
  name: 'garment_tags',
  effort: 'low',
  system: `${BASE_RULES}
You get a cut-out photo of one clothing item. Tag it for a wardrobe app.
"title": 2–4 words a person would say, e.g. "black hoodie", "wide-leg jeans". "color": the main colour in plain words.
"material", "fit" (e.g. "oversize", "slim", "straight") and "pattern" only when you can tell from the photo, else null.`,
  schema: obj({ title: str, kind, color: str, material: strOrNull, fit: strOrNull, pattern: strOrNull, season: { type: 'string', enum: ['all', 'summer', 'winter', 'spring_autumn'] } })
}

export const dedupeGarments: Task<{ groups: string[][] }> = {
  name: 'garment_duplicates',
  effort: 'low',
  system: `${BASE_RULES}
You get several tagged clothing items, each with an id and a photo. Some may be the same physical item seen twice.
Group ids that are the same item (same piece, not just similar). Every id appears in exactly one group; singletons are fine.`,
  schema: obj({ groups: arr(arr(str)) })
}

// ── Скан себя ──────────────────────────────────────────────────────────────

export interface AnglePick {
  front: number | null
  three_quarter: number | null
  side: number | null
  back: number | null
  problems: string[]
}

export const pickAngles: Task<AnglePick> = {
  name: 'body_angles',
  effort: 'medium',
  system: `${BASE_RULES}
You get numbered frames from a 6-second video of a person turning around slowly, phone on a shelf.
Pick the best frame for each angle: front, three_quarter (about 45°), side (90°) and back.
A good frame shows the whole body from head to feet, both feet fully in frame, is sharp (no motion blur), arms relaxed.
Use null when no frame works for that angle. In "problems" list short, fixable advice for the person
("step back so your feet are in frame", "more light"), or an empty list.`,
  schema: obj({ front: { type: ['integer', 'null'] }, three_quarter: { type: ['integer', 'null'] }, side: { type: ['integer', 'null'] }, back: { type: ['integer', 'null'] }, problems: arr(str) })
}

// ── Новая вещь: скриншот, фото в магазине ─────────────────────────────────────

export interface TagReading {
  brand: string | null
  product_name: string | null
  kind: GarmentKind | null
  color: string | null
  /** артикул с бирки (у Zara, Bershka, Pull & Bear — REF вида 1234/567/800) */
  ref: string | null
  price: number | null
  /** зачёркнутая цена на ценнике со скидкой */
  old_price: number | null
  currency: string | null
  size: string | null
  composition: string | null
  on_sale: boolean
  is_screenshot: boolean
}

export const readTag: Task<TagReading> = {
  name: 'tag_reading',
  effort: 'medium',
  system: `${BASE_RULES}
You get one or more photos of a clothing item someone wants to buy: a screenshot from a shop or Instagram,
or photos taken in a store of the item and its price tag or care label.
Read what is printed: brand, product name, the article reference (for Zara, Bershka and Pull & Bear the "REF" code,
digits separated by slashes, e.g. 1234/567/800), price, size and fabric composition.
If the price tag shows a crossed-out price and a lower one, "old_price" is the crossed-out one, "price" the current one
and "on_sale" is true. "currency" is the ISO code (EUR, GBP, USD…) from the symbol, or null.
Numbers only for prices (39.95, not "€39,95"). Never invent a reference or a price you cannot read.`,
  schema: obj({ brand: strOrNull, product_name: strOrNull, kind: { type: ['string', 'null'], enum: [...GARMENT_KINDS, null] }, color: strOrNull, ref: strOrNull, price: numOrNull, old_price: numOrNull, currency: strOrNull, size: strOrNull, composition: strOrNull, on_sale: bool, is_screenshot: bool })
}

export interface SimilarVerdict {
  verdict: 'new' | 'similar' | 'duplicate'
  similar: { id: string; reason: string }[]
}

export const findSimilar: Task<SimilarVerdict> = {
  name: 'similar_owned',
  effort: 'medium',
  system: `${BASE_RULES}
You get a new item the person is thinking of buying (photo and tags) and their closet as a list of items (id, tags, photo).
Find closet items that do the same job in an outfit: same kind and a close colour, cut or style.
"duplicate" — they already own practically the same piece; "similar" — something close; "new" — nothing like it.
"reason" is one short sentence for the person, e.g. "Same light wash, but yours is a straight cut".
At most 5 items, most similar first. Only ids from the list.`,
  schema: obj({ verdict: { type: 'string', enum: ['new', 'similar', 'duplicate'] }, similar: arr(obj({ id: str, reason: str })) })
}

// ── Образы ────────────────────────────────────────────────────────────────

export interface Looks {
  looks: { title: string; item_ids: string[]; note: string }[]
}

export const buildLooks: Task<Looks> = {
  name: 'outfits',
  effort: 'high',
  system: `${BASE_RULES}
You are a calm, practical stylist. You get new pieces the person is considering and their closet (ids, tags, photos),
sometimes an occasion, and their style (styles with weights, colours, styles to leave out). Build exactly 3 outfits.
Every outfit uses at least one new piece and pieces from the closet, one item per body zone (top, bottom or dress,
optional outerwear, shoes). Only ids from the lists. Keep outfits in their style; never pair pieces from styles that
clash (pressed wool trousers with a hoodie) unless they ask.
"title": 1–2 words (e.g. "Weekend", "Friday dinner"). "note": one sentence why it works, plain and specific.`,
  schema: obj({ looks: arr(obj({ title: str, item_ids: arr(str), note: str })) })
}

// ── Проверка примерки ───────────────────────────────────────────────────────

export interface TryOnCheck {
  same_person: boolean
  pose_unchanged: boolean
  garment_matches: boolean
  seam_visible: boolean
  score: number
  issue: string | null
}

export const checkTryOn: Task<TryOnCheck> = {
  name: 'tryon_check',
  effort: 'medium',
  system: `${BASE_RULES}
You get three images: 1) the person's original photo, 2) a try-on result, 3) the garment they wanted to try.
Judge the result strictly: is it clearly the same person; is the pose and framing unchanged; does the garment match
the sample (colour, print, length, details); is any seam or patch visible where the new clothes meet skin or background.
"score" 0–10 for how much the person can trust this image to decide. "issue": the main problem in a few words, or null.`,
  schema: obj({ same_person: bool, pose_unchanged: bool, garment_matches: bool, seam_visible: bool, score: { type: 'number' }, issue: strOrNull })
}

// ── Магазины: поиск вещи и распродажи (веб-поиск Muse Spark) ───────────────────────

export interface FoundProducts {
  products: { title: string; url: string; price: number | null; currency: string | null; in_stock: boolean | null }[]
}

export function findProduct(store: { name: string; domain: string }): Task<FoundProducts> {
  return {
    name: 'store_product',
    effort: 'low',
    system: `${BASE_RULES}
Search the web for one clothing item in one store: ${store.name}, website ${store.domain}.
Only product pages on ${store.domain} count (any country path). Prefer the page for the person's country.
Match the article reference exactly when one is given. "price" is the current price on that page in its currency, as a number.
If you cannot find the item on ${store.domain}, return an empty list. Never return pages from other sites.`,
    schema: obj({ products: arr(obj({ title: str, url: str, price: numOrNull, currency: strOrNull, in_stock: { type: ['boolean', 'null'] } })) })
  }
}

export interface SaleStatus {
  on_sale: boolean
  source_url: string | null
  ends: string | null
}

export function storeSale(store: { name: string; domain: string }): Task<SaleStatus> {
  return {
    name: 'store_sale',
    effort: 'low',
    system: `${BASE_RULES}
Is ${store.name} (${store.domain}) running a sale (seasonal sale, Black Friday, a site-wide discount) in the person's country right now?
Use today's information from the web. "source_url" is the page that shows it (prefer ${store.domain}), "ends" the end date if stated (YYYY-MM-DD).
If you are not sure, answer false.`,
    schema: obj({ on_sale: bool, source_url: strOrNull, ends: strOrNull })
  }
}

/** Ссылки на страницы магазина — и из ответа, и из цитат (на случай, если модель не вписала ссылку в JSON) */
export function storeLinks(raw: ResponsesOutput, domain: string): string[] {
  return citations(raw)
    .map((c) => c.url)
    .filter((u) => {
      try {
        const host = new URL(u).hostname
        return host === domain || host.endsWith(`.${domain}`)
      } catch {
        return false
      }
    })
}
