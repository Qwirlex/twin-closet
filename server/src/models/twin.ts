// Twin — стилист в чате: Muse Spark с инструментами. Модель решает, что вызвать; сервер выполняет и возвращает результат.
// Имена инструментов не пересекаются с зарезервированными web_search (browser.search, browser.open, browser.find).
import { MODELS } from '../meta'

export const TWIN_SYSTEM = `You are Twin, the stylist inside Twin Closet. You know the person's closet, their wishlist and their favourite stores.
Talk like a friend with good taste: short, warm, specific. Two or three sentences, then act.
- Build outfits mostly from what they already own; add at most one or two new pieces, from their wishlist first,
  then from their favourite stores (use search_store; only live stores can be searched — others are "coming soon").
- Dress them in their own style (get_style): its silhouettes, pieces and colours; leave out the styles it avoids unless
  they ask. No plain basics unless asked: every outfit has one live detail — a silhouette, layers, an accent or a texture.
- Always say which pieces are theirs and which are new. Never invent pieces, prices or links: use only tool results.
- When they like an outfit, offer to try it on (start_try_on). When they like a found piece, offer to save it (add_to_wishlist).
- If they ask how to scan: prop the phone up, full height with feet in frame, turn slowly for six seconds;
  for the closet, film one slow pass along the rail, or hold pieces up one by one.`

const fn = (name: string, description: string, properties: Record<string, unknown>) => ({
  type: 'function',
  name,
  description,
  strict: true,
  parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
})

export const TWIN_TOOLS = [
  fn('get_closet', 'The person’s closet: ids, tags and kinds of every item they own.', { kind: { type: ['string', 'null'], description: 'Only this kind (top, bottom, dress, outerwear, shoes, accessory), or null for all.' } }),
  fn('get_wishlist', 'Pieces the person saved to buy later, with store, price and whether the price dropped.', {}),
  fn('get_style', 'The person’s style profile from the quiz: main styles with weights, colours they like, styles to leave out, and a guide for each style.', {}),
  fn('get_stores', 'The person’s favourite stores, which of them are live for search, and their country.', {}),
  fn('search_store', 'Find a piece in one live store for the person’s country. Returns product pages with prices.', {
    store_id: { type: 'string', description: 'A live store id from get_stores.' },
    query: { type: 'string', description: 'What to look for, e.g. "light wash wide-leg jeans".' }
  }),
  fn('add_to_wishlist', 'Save a found product to the wishlist so its price is watched.', { url: { type: 'string' }, title: { type: 'string' }, price: { type: ['number', 'null'] }, currency: { type: ['string', 'null'] } }),
  fn('start_try_on', 'Show an outfit on the person’s own photo. Takes item ids from the closet and the wishlist.', { item_ids: { type: 'array', items: { type: 'string' } }, title: { type: 'string' } })
]

/** Один ход Twin: история диалога + инструменты; дальше сервер крутит цикл «вызов → результат» */
export function twinRequest(input: unknown[], previousResponseId?: string): Record<string, unknown> {
  return {
    model: MODELS.spark,
    instructions: TWIN_SYSTEM,
    input,
    tools: TWIN_TOOLS,
    max_output_tokens: 6000,
    reasoning: { effort: 'medium' },
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {})
  }
}
