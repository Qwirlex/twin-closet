// Twin (docs/spec-models.md, «F»): Muse Spark с инструментами. Модель зовёт инструмент — сервер отвечает данными из
// контекста приложения (шкаф, вишлист, стиль, магазины) или ищет в живом магазине; «сохранить» и «примерить» не делаем
// на сервере, а возвращаем приложению действиями — кнопки нажимает человек
import { isLiveStore, isStorePage, LIVE_STORE_IDS, LIVE_STORES, STYLES, trendHits, trendsFor, type ClosetRef, type StyleProfile, type TrendDigest, type TwinAction, type TwinReply } from '@twin/shared'
import { outputText, type MetaApi, type ResponsesOutput } from '../meta'
import { findProduct, runTask, text } from '../models/spark'
import { twinRequest } from '../models/twin'

export interface TwinContext {
  closet: ClosetRef[]
  wishlist: { id: string; name: string; storeId: string | null; price: number | null; currency: string | null; onSale?: boolean }[]
  style: StyleProfile | null
  favorites: string[]
  country: string
  who: 'men' | 'women' | 'all'
}

/** До стольких вызовов инструментов за один ответ — дальше модель отвечает тем, что есть */
const MAX_ROUNDS = 6

interface FunctionCall {
  type: 'function_call'
  call_id: string
  name: string
  arguments: string
}

const calls = (r: ResponsesOutput) => r.output.filter((o): o is FunctionCall & ResponsesOutput['output'][number] => o.type === 'function_call') as unknown as FunctionCall[]

/** Один инструмент: данные — JSON-строкой для модели; действия — в список для приложения */
async function runTool(meta: MetaApi, ctx: TwinContext, digest: TrendDigest, call: FunctionCall, actions: TwinAction[]): Promise<unknown> {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
  } catch {
    return { error: 'arguments are not JSON' }
  }
  switch (call.name) {
    case 'get_closet': {
      const kind = typeof args.kind === 'string' ? args.kind : null
      return { items: ctx.closet.filter((c) => !kind || c.kind === kind) }
    }
    case 'get_wishlist':
      return { items: ctx.wishlist }
    case 'get_style':
      return ctx.style
        ? { styles: ctx.style.styles.map((s) => ({ ...s, name: STYLES[s.id].name, guide: STYLES[s.id].line, silhouette: STYLES[s.id].silhouette, pieces: STYLES[s.id].pieces })), colors: ctx.style.colors, avoid: ctx.style.avoid.map((id) => STYLES[id].name) }
        : { styles: [], note: 'No style quiz yet: ask what they like.' }
    case 'get_trends':
      return {
        season: `${digest.season}, ${digest.region}`,
        trends: trendsFor(digest, ctx.style, ctx.who)
          .slice(0, 8)
          .map((t) => ({ name: t.name, how: t.line, their_pieces: ctx.closet.filter((c) => trendHits(`${c.title} ${c.color ?? ''}`, digest).some((h) => h.id === t.id)).map((c) => c.id) }))
      }
    case 'get_stores':
      return { country: ctx.country, stores: ctx.favorites.map((id) => ({ id, live: isLiveStore(id), name: isLiveStore(id) ? LIVE_STORES[id].name : id })), all_live: [...LIVE_STORE_IDS] }
    case 'search_store': {
      const id = String(args.store_id ?? '')
      const query = String(args.query ?? '').slice(0, 200)
      if (!isLiveStore(id)) return { error: 'This store is coming soon; search a live one from get_stores.' }
      if (!query) return { error: 'query is empty' }
      const { data } = await runTask(meta, findProduct(LIVE_STORES[id]), [text(`Item: ${query}\nCountry: ${ctx.country}`)], { webSearchCountry: ctx.country })
      return { products: data.products.filter((p) => isStorePage(p.url, id)).slice(0, 5) }
    }
    case 'add_to_wishlist': {
      const url = String(args.url ?? '')
      if (!LIVE_STORE_IDS.some((id) => isStorePage(url, id))) return { error: 'Only product pages of live stores can be saved.' }
      actions.push({ type: 'wishlist', url, title: String(args.title ?? '').slice(0, 120), price: typeof args.price === 'number' ? args.price : null, currency: typeof args.currency === 'string' ? args.currency : null })
      return { ok: true, note: 'The person sees a Save button for it.' }
    }
    case 'start_try_on': {
      const known = new Set([...ctx.closet.map((c) => c.id), ...ctx.wishlist.map((w) => w.id)])
      const ids = (Array.isArray(args.item_ids) ? args.item_ids : []).map(String).filter((id) => known.has(id))
      if (!ids.length) return { error: 'Use item ids from get_closet or get_wishlist.' }
      actions.push({ type: 'try_on', itemIds: ids, title: String(args.title ?? 'Try it on').slice(0, 60) })
      return { ok: true, note: 'The person sees a Try it on button.' }
    }
    default:
      return { error: `unknown tool ${call.name}` }
  }
}

/** Ход Twin: история → цикл «модель зовёт инструменты → результаты» → ответ текстом и действия */
export async function twinTurn(meta: MetaApi, messages: { role: 'user' | 'assistant'; text: string }[], ctx: TwinContext, digest: TrendDigest): Promise<TwinReply> {
  const actions: TwinAction[] = []
  let raw = await meta.responses(twinRequest(messages.map((m) => ({ role: m.role, content: m.text }))))
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const pending = calls(raw)
    if (!pending.length) break
    const outputs = []
    for (const c of pending) {
      const out = await runTool(meta, ctx, digest, c, actions).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }))
      outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(out) })
    }
    raw = await meta.responses(twinRequest(outputs, raw.id))
  }
  return { text: outputText(raw).trim() || 'Here is what I found.', actions, responseId: raw.id }
}
