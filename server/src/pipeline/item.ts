// Новая вещь (docs/spec-models.md, «B»): скриншот или фото в магазине → что это (Spark) → вырезка (SAM) →
// та же вещь в магазине (Spark + веб-поиск) → что похожее уже есть в шкафу (Spark)
import { copyFileSync } from 'node:fs'
import { isLiveStore, isStorePage, LIVE_STORE_IDS, LIVE_STORES, type ClosetRef, type Garment, type GarmentKind, type LiveStoreId } from '@twin/shared'
import { JobError } from '../errors'
import { conceptPrompt } from '../models/sam'
import { findProduct, findSimilar, imagePart, readTag, runTask, storeLinks, text, type Part, type TagReading } from '../models/spark'
import { bestObject, cutout, objectMask, runSam } from './common'
import type { StepContext } from './context'

/** Понятие для SAM, если по названию ничего не нашлось: одно существительное на вид вещи */
const KIND_CONCEPT: Record<GarmentKind, string> = { top: 'top', bottom: 'trousers', dress: 'dress', outerwear: 'jacket', shoes: 'shoes', accessory: 'bag' }

const VIEW_WORDS: Record<string, string> = { front: 'the piece from the front', back: 'the piece from the back', label: 'the care label', tag: 'the price tag', video: 'a frame of a short video turning the piece' }

/** Живой магазин по бренду с бирки («ZARA» → zara) */
export function storeByBrand(brand: string | null): LiveStoreId | null {
  const b = (brand ?? '').trim().toLowerCase().replace(/[^a-z0-9&]+/g, '')
  if (!b) return null
  return LIVE_STORE_IDS.find((id) => LIVE_STORES[id].name.toLowerCase().replace(/[^a-z0-9&]+/g, '') === b) ?? null
}

/** Короткое имя вещи для подписи и для SAM: «Wide-leg jeans with pleats ZW» → «wide-leg jeans with pleats» (до 4 слов, без бренда) */
export function shortTitle(r: TagReading): string {
  const brand = (r.brand ?? '').toLowerCase()
  const words = (r.product_name ?? '')
    .split(/\s+/)
    .filter((w) => w && w.toLowerCase() !== brand && !/^(zw|ref|\d+)$/i.test(w))
    .slice(0, 4)
  if (words.length) return words.join(' ').toLowerCase()
  return [r.color, r.kind ? KIND_CONCEPT[r.kind] : 'piece'].filter(Boolean).join(' ').toLowerCase()
}

/** Шаг read: Muse Spark читает все снимки (перед, спина, ярлык, бирка) или один скриншот */
export async function readItem(ctx: StepContext): Promise<void> {
  // умный скан — снимки по ракурсам (${job}-s<i>.jpg), иначе одно фото или скриншот (${job}.jpg)
  const video = ctx.result.keyframeTimes?.length ? ctx.result.keyframeTimes : null
  const photos = ctx.result.shots
    ? ctx.result.shots.map((s, i) => ({ view: s.view, path: ctx.store.path(`${ctx.jobId}-s${i}.jpg`) }))
    : video
      ? video.map((_, i) => ({ view: 'video', path: ctx.store.path(`${ctx.jobId}-k${i}.jpg`) }))
      : [{ view: 'front', path: ctx.store.path(`${ctx.jobId}.jpg`) }]
  const parts: Part[] = []
  for (const [i, p] of photos.entries()) {
    parts.push(text(`Photo ${i + 1}: ${VIEW_WORDS[p.view] ?? 'the piece'}`))
    parts.push(await imagePart(p.path))
  }
  const { data } = await runTask(ctx.meta, readTag, parts).catch((e: unknown) => {
    throw new JobError('model', `Muse Spark could not read the photo: ${e instanceof Error ? e.message : e}`)
  })
  ctx.scratch.reading = data
}

/** Шаг cutout: SAM 3.1 по названию вещи, потом по виду; ничего — вырезкой остаётся фото (вещь не теряется) */
export async function cutItem(ctx: StepContext): Promise<void> {
  const r = ctx.scratch.reading as TagReading
  const main = ctx.store.path(`${ctx.jobId}.jpg`)
  const photo = await imagePart(main)
  const image = { imageUrl: (photo as { image_url: string }).image_url }
  const concepts = [...new Set([shortTitle(r), r.kind ? KIND_CONCEPT[r.kind] : null].filter((c): c is string => !!c))]
  let cut: string | null = null
  for (const c of concepts) {
    const best = bestObject(await runSam(ctx.meta, conceptPrompt(c), image))
    if (!best) continue
    const { width, height } = ctx.result.media ?? { width: 0, height: 0 }
    const m = objectMask(best, width, height)
    const out = ctx.store.path(`${ctx.jobId}-cut.png`)
    if (await cutout(main, m, out)) {
      cut = `/files/${ctx.jobId}-cut.png`
      break
    }
  }
  if (!cut) {
    copyFileSync(main, ctx.store.path(`${ctx.jobId}-cut.jpg`))
    ctx.result.notes = [...(ctx.result.notes ?? []), 'SAM 3.1 did not find the piece — the photo is kept as it is.']
  }
  const storeId = storeByBrand(r.brand)
  const item: Garment = {
    id: ctx.jobId,
    source: r.is_screenshot ? 'screenshot' : 'store_scan',
    kind: r.kind ?? 'top',
    title: shortTitle(r).replace(/^./, (c) => c.toUpperCase()),
    color: r.color ?? '',
    material: r.composition,
    cutoutUrl: cut ?? `/files/${ctx.jobId}-cut.jpg`,
    sourceFrameUrl: `/files/${ctx.jobId}.jpg`,
    shop: { brand: storeId ? LIVE_STORES[storeId].name : r.brand, price: r.price !== null ? `${r.price}${r.currency ? ` ${r.currency}` : ''}` : null, url: null, sizes: r.size, ref: r.ref },
    createdAt: new Date().toISOString()
  }
  ctx.result.item = item
}

/** Шаг online: живой магазин и есть REF или название → та же вещь на сайте магазина (ссылка и цена) */
export async function findOnline(ctx: StepContext): Promise<void> {
  const r = ctx.scratch.reading as TagReading
  const storeId = storeByBrand(r.brand)
  const item = ctx.result.item
  if (!item || !storeId || !isLiveStore(storeId) || (!r.ref && !r.product_name)) return
  const store = LIVE_STORES[storeId]
  const country = (ctx.input as { country?: string }).country ?? 'IE'
  const lines = [r.ref ? `Article reference (REF): ${r.ref}` : null, r.product_name ? `Item: ${r.product_name}${r.color ? `, ${r.color}` : ''}` : null, `Country: ${country}`].filter(Boolean)
  const { data, raw } = await runTask(ctx.meta, findProduct(store), [text(lines.join('\n'))], { webSearchCountry: country }).catch((e: unknown) => {
    throw new JobError('model', `Muse Spark search failed: ${e instanceof Error ? e.message : e}`)
  })
  const hit = data.products.find((p) => isStorePage(p.url, storeId)) ?? null
  const url = hit?.url ?? storeLinks(raw, storeId)[0] ?? null
  item.shop = { ...item.shop!, url, price: hit?.price != null ? `${hit.price}${hit.currency ? ` ${hit.currency}` : ''}` : item.shop!.price }
  if (hit) ctx.result.products = [{ title: hit.title, url: hit.url, price: hit.price, currency: hit.currency, snippet: '' }]
}

/** Шаг similar: что похожее уже есть в шкафу (шкаф приходит с задачей из приложения) */
export async function similarItems(ctx: StepContext): Promise<void> {
  const closet = closetOf(ctx)
  const item = ctx.result.item
  if (!item || !closet.length) {
    ctx.result.similar = []
    return
  }
  const cut = ctx.store.path(item.cutoutUrl.replace(/^\/files\//, ''))
  const parts: Part[] = [
    text(`New item: ${item.title}; kind ${item.kind}; colour ${item.color || 'unknown'}${item.material ? `; ${item.material}` : ''}.`),
    await imagePart(cut),
    text(`Closet:\n${closet.map((c) => `- id ${c.id}: ${c.title}; kind ${c.kind ?? 'unknown'}${c.color ? `; colour ${c.color}` : ''}`).join('\n')}`)
  ]
  const { data } = await runTask(ctx.meta, findSimilar, parts).catch((e: unknown) => {
    throw new JobError('model', `Muse Spark could not compare with the closet: ${e instanceof Error ? e.message : e}`)
  })
  const ids = new Set(closet.map((c) => c.id))
  ctx.result.similar = data.similar.filter((s) => ids.has(s.id)).map((s) => ({ garmentId: s.id, reason: s.reason }))
}

function closetOf(ctx: StepContext): ClosetRef[] {
  const c = (ctx.input as { closet?: ClosetRef[] }).closet
  return Array.isArray(c) ? c : []
}
