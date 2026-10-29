// Модно, а не базово (PLAN.md §1.2 Д, docs/spec-trends.md): выжимка трендов сезона для сборки образов, Twin и вкладки Trending.
// С ключом сервер раз в неделю просит Muse Spark собрать свежую выжимку по стране; без ключа — CURATED_TRENDS.
import { STYLE_IDS, type StyleId, type StyleProfile } from './style'

export const TREND_KINDS = ['silhouette', 'colour', 'piece', 'pattern', 'texture', 'styling'] as const
export type TrendKind = (typeof TREND_KINDS)[number]

export interface Trend {
  id: string
  name: string
  kind: TrendKind
  /** как носить, одной строкой */
  line: string
  /** к каким стилям справочника тренд подходит */
  styles: StyleId[]
  /** слова для поиска в вещах шкафа (название, подпись, ткань, цвет), нижний регистр */
  keywords: string[]
  who: 'men' | 'women' | 'all'
}

export interface TrendDigest {
  season: string
  region: string
  updatedAt: string
  source: 'curated' | 'spark'
  trends: Trend[]
  sources: { name: string; url: string }[]
}

const T = (id: string, name: string, kind: TrendKind, who: Trend['who'], line: string, styles: StyleId[], keywords: string[]): Trend => ({ id, name, kind, who, line, styles, keywords })

/**
 * Осень-зима 2026, Европа. Пересказ своими словами по обзорам сезона (октябрь 2026), тексты не копируем.
 * Порядок — от самого носибельного к самому смелому
 */
export const CURATED_TRENDS: TrendDigest = {
  season: 'Autumn/Winter 2026',
  region: 'Europe',
  updatedAt: '2026-10-29',
  source: 'curated',
  trends: [
    T('military-jackets', 'Military jackets', 'piece', 'all', 'A field jacket, bomber or officer coat over a soft knit or a plain tee.', ['military', 'workwear', 'khaki_coded', 'casual', 'streetwear'], ['military', 'bomber', 'field jacket', 'officer coat', 'flight jacket', 'm-65']),
    T('busy-knits', 'Busy knitwear', 'texture', 'all', 'Swap the plain jumper for Fair Isle, big cables, retro stripes or a zip cardigan.', ['eclectic_grandpa', 'ivy_prep', 'dark_academia', 'light_academia', 'old_money', 'smart_casual'], ['fair isle', 'cable', 'cable knit', 'cardigan', 'zip cardigan', 'striped knit']),
    T('red-accent', 'One red accent', 'colour', 'all', 'One red piece as the new neutral — a belt, socks, a knit or a bag — with black, grey or denim.', ['nineties_minimal', 'scandi_minimal', 'parisian', 'casual', 'smart_casual', 'sprezzatura'], ['red', 'crimson', 'scarlet', 'cherry']),
    T('rich-textures', 'Rich textures', 'texture', 'all', 'One tactile piece per outfit: velvet, jacquard, suede, corduroy or a faux-fur collar.', ['old_money', 'seventies', 'dark_academia', 'western', 'glamoratti', 'smart_casual'], ['velvet', 'jacquard', 'suede', 'corduroy', 'cord', 'faux fur', 'shearling', 'boucle', 'bouclé']),
    T('dressed-up-plaid', 'Plaid, dressed up', 'pattern', 'all', 'Checks beyond the flannel shirt: check trousers or a plaid skirt with a sharp coat and boots.', ['old_money', 'dark_academia', 'ivy_prep', 'grunge', 'punk'], ['plaid', 'check', 'checked', 'tartan', 'houndstooth', 'prince of wales']),
    T('rugby-shirt', 'The rugby shirt', 'piece', 'all', 'A heavy striped rugby shirt with a contrast collar instead of a sweater, over straight jeans.', ['ivy_prep', 'blokecore', 'casual', 'old_money'], ['rugby', 'rugby shirt']),
    T('undone-tailoring', 'Undone tailoring', 'styling', 'all', 'Wear the blazer open, the shirt loose and the tie off — tailoring with jeans or knitwear.', ['sprezzatura', 'smart_casual', 'parisian', 'old_money', 'poetcore'], ['blazer', 'suit jacket', 'tailored', 'sport coat']),
    T('lean-lines', 'Longer, leaner lines', 'silhouette', 'all', 'After years of baggy: a long coat over straight or slim trousers, one clean line head to toe.', ['nineties_minimal', 'scandi_minimal', 'dark_avant', 'mod', 'office_siren'], ['long coat', 'overcoat', 'slim', 'straight', 'straight-leg', 'straight leg', 'skinny']),
    T('hoods-and-scarves', 'Hoods and big scarves', 'styling', 'all', 'Hood up, a sculpted scarf or a balaclava — warmth that frames the face.', ['streetwear', 'techwear', 'gorpcore', 'dark_avant', 'casual'], ['hoodie', 'hood', 'scarf', 'balaclava', 'snood']),
    T('western-details', 'Western details', 'piece', 'all', 'Pointed boots, a western belt or suede with denim — one cowboy note, not a costume.', ['western', 'seventies', 'boho', 'workwear'], ['western', 'cowboy', 'pointed boot', 'pointed boots', 'belt buckle', 'fringe']),
    T('yellow', 'Butter and Naples yellow', 'colour', 'all', 'A soft yellow knit or trench with brown, grey or navy instead of the usual autumn burgundy.', ['scandi_minimal', 'light_academia', 'coastal', 'smart_casual', 'japanese_minimal'], ['yellow', 'butter', 'mustard', 'ochre']),
    T('slim-flat-shoes', 'Slim, flat shoes', 'piece', 'all', 'Low, narrow shoes: ballet-flat sneakers, slim derbies, loafers — less chunky sole.', ['parisian', 'nineties_minimal', 'balletcore', 'sprezzatura', 'smart_casual'], ['ballet flat', 'ballet flats', 'loafer', 'loafers', 'derby', 'derbies', 'slim sneaker']),
    T('plum-purple', 'Plum and royal purple', 'colour', 'women', 'Plum, aubergine or a royal purple piece with black, camel or chocolate brown.', ['romantic', 'glamoratti', 'whimsigoth', 'parisian', 'maximalist'], ['purple', 'plum', 'aubergine', 'violet', 'lilac']),
    T('drop-waist', 'Low waistlines', 'silhouette', 'women', 'Drop-waist dresses and low-slung skirts, worn with knee boots or flat shoes.', ['romantic', 'balletcore', 'boho', 'seventies', 'office_siren'], ['drop waist', 'drop-waist', 'low waist', 'low-rise'])
  ],
  sources: [
    { name: 'GQ UK — autumn/winter 2026 menswear trends', url: 'https://www.gq-magazine.co.uk/article/autumn-winter-2026-menswear-trends' },
    { name: 'L’Officiel — men’s fall/winter 2026 runway trends', url: 'https://www.lofficielph.com/hommes/fall-winter-2026-mens-runway-fashion-trends' },
    { name: 'Harper’s Bazaar — fall 2026 trends', url: 'https://www.harpersbazaar.com/fashion/trends/a74170659/fall-trends-2026/' },
    { name: 'Who What Wear — fall 2026 trends', url: 'https://www.whowhatwear.com/fashion/top-fall-2026-trends-according-to-editors' },
    { name: 'Glamour — how to layer for fall 2026', url: 'https://www.glamour.com/story/how-to-layer-this-fall' }
  ]
}

const MAX_TRENDS = 16
const isStyleId = (v: unknown): v is StyleId => typeof v === 'string' && (STYLE_IDS as string[]).includes(v)
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const slug = (v: string): string =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

/** Выжимка из ответа модели: только валидное, лишнее обрезаем; ничего годного — null */
export function cleanDigest(raw: unknown, now = new Date()): TrendDigest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const trends: Trend[] = []
  for (const t of Array.isArray(r.trends) ? r.trends : []) {
    if (!t || typeof t !== 'object' || trends.length >= MAX_TRENDS) continue
    const x = t as Record<string, unknown>
    const name = str(x.name, 40)
    const line = str(x.line, 160)
    const kind = TREND_KINDS.find((k) => k === x.kind)
    const styles = Array.isArray(x.styles) ? [...new Set(x.styles.filter(isStyleId))].slice(0, 6) : []
    const keywords = Array.isArray(x.keywords) ? [...new Set(x.keywords.map((k) => str(k, 30).toLowerCase()).filter(Boolean))].slice(0, 8) : []
    const who = x.who === 'men' || x.who === 'women' ? x.who : 'all'
    const id = slug(str(x.id, 40) || name)
    if (!name || line.length < 10 || !kind || !styles.length || !keywords.length || !id || trends.some((o) => o.id === id)) continue
    trends.push({ id, name, kind, line, styles, keywords, who })
  }
  if (!trends.length) return null
  const sources = (Array.isArray(r.sources) ? r.sources : [])
    .map((s) => (s && typeof s === 'object' ? { name: str((s as Record<string, unknown>).name, 80), url: str((s as Record<string, unknown>).url, 300) } : null))
    .filter((s): s is { name: string; url: string } => !!s && !!s.name && /^https:\/\//.test(s.url))
    .slice(0, 8)
  return { season: str(r.season, 40) || CURATED_TRENDS.season, region: str(r.region, 40) || CURATED_TRENDS.region, updatedAt: now.toISOString().slice(0, 10), source: 'spark', trends, sources }
}

/** Тренды для человека: сначала совпавшие со стилями профиля (по весам), без «избегаю» и без чужих для его опроса */
export function trendsFor(digest: TrendDigest, profile: StyleProfile | null, who: 'men' | 'women' | 'all' = 'all'): Trend[] {
  const weight = (t: Trend) => profile?.styles.filter((s) => t.styles.includes(s.id)).reduce((sum, s) => sum + s.weight, 0) ?? 0
  return digest.trends
    .filter((t) => who === 'all' || t.who === 'all' || t.who === who)
    .filter((t) => !profile || !t.styles.every((s) => profile.avoid.includes(s)))
    .map((t, i) => ({ t, i, w: weight(t) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.t)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasWord = (text: string, word: string) => new RegExp(`(^|[^a-z])${escape(word)}([^a-z]|$)`, 'i').test(text)

/** Какие тренды есть в вещи: по целым словам в названии, подписи, ткани, цвете */
export function trendHits(text: string, digest: TrendDigest): Trend[] {
  return digest.trends.filter((t) => t.keywords.some((k) => hasWord(text, k)))
}

export interface OutfitPiece {
  kind: string
  title: string
  color: string | null
  material: string | null
}

const BASIC_COLOURS = ['white', 'black', 'grey', 'gray', 'navy', 'blue', 'beige', 'cream', 'ecru', 'stone', 'denim', 'light wash', 'mid wash', 'dark wash', 'charcoal', 'off-white']
const TEXTURES = ['suede', 'velvet', 'corduroy', 'cord', 'boucle', 'bouclé', 'shearling', 'tweed', 'faux fur', 'cashmere', 'mohair', 'wool', 'leather', 'knit', 'jacquard', 'satin']

/**
 * Живая деталь образа: тренд → его название; верх поверх → «layers»; цвет не из базовых → «colour accent»;
 * фактура → «texture». Ничего — null: это «скучная база» (белая футболка + джинсы + кеды)
 */
export function liveDetail(pieces: OutfitPiece[], digest: TrendDigest): string | null {
  for (const p of pieces) {
    const hit = trendHits(`${p.title} ${p.color ?? ''} ${p.material ?? ''}`, digest)[0]
    if (hit) return hit.name
  }
  if (pieces.some((p) => p.kind === 'outerwear')) return 'layers'
  if (pieces.some((p) => p.color && !BASIC_COLOURS.some((c) => hasWord(p.color!, c)))) return 'colour accent'
  // кожа у обуви — обычное дело, фактурой не считаем
  if (pieces.some((p) => p.material && TEXTURES.some((m) => hasWord(p.material!, m)) && !(p.kind === 'shoes' && /leather/i.test(p.material)))) return 'texture'
  return null
}

/** Для сборки образов и Twin: 6 трендов под человека и правило «тренд не навязываем» */
export function trendPrompt(digest: TrendDigest, profile: StyleProfile | null, who: 'men' | 'women' | 'all' = 'all'): string {
  const list = trendsFor(digest, profile, who)
    .slice(0, 6)
    .map((t) => `- ${t.name}: ${t.line}`)
  return [`In fashion now (${digest.season}, ${digest.region}):`, ...list, 'Use one or two of these in an outfit only when they fit the person’s style; never force a trend.'].join('\n')
}
