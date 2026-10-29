// Стиль человека (PLAN.md §1.2 Е и Д): справочник стилей для Muse Spark, профиль из опроса, правила для сборки образов.
// Модель не дообучаем: Spark получает справочник и применяет его к фото и шкафу.
// Список — живые нишевые стили и тренды 2026 (Pinterest Predicts 2026: poetcore, glamoratti, khaki coded, extra celestial)

export const STYLE_FAMILIES = ['classic', 'academia', 'minimal', 'tokyo', 'work', 'street', 'dark', 'future', 'soft', 'sport', 'retro', 'glam'] as const
export type StyleFamily = (typeof STYLE_FAMILIES)[number]

export const FAMILY_NAME: Record<StyleFamily, string> = {
  classic: 'Classic & tailored',
  academia: 'Academia',
  minimal: 'Minimal',
  tokyo: 'Tokyo & Seoul',
  work: 'Work & outdoor',
  street: 'Street',
  dark: 'Dark & avant-garde',
  future: 'Future',
  soft: 'Soft & romantic',
  sport: 'Sport',
  retro: 'Retro',
  glam: 'Glam & maximal'
}

/** Кому показываем в опросе: стили, которые носят почти только женщины, мужчинам не показываем (и наоборот) */
export type StyleFor = 'all' | 'women' | 'men'

export interface StyleGuide {
  id: string
  name: string
  family: StyleFamily
  for: StyleFor
  /** коротко для карточек и профиля */
  line: string
  silhouette: string
  pieces: string[]
  fabrics: string[]
  colors: string[]
}

type Row = [name: string, family: StyleFamily, who: StyleFor, line: string, silhouette: string, pieces: string[], fabrics: string[], colors: string[]]

const ROWS = {
  // ── Classic & tailored
  old_money: ['Old money', 'classic', 'all', 'Quiet luxury: cashmere, pressed trousers, loafers, no logos', 'relaxed tailoring, fine knit over a collar, trousers with a crease', ['cable or fine-gauge knit', 'oxford shirt', 'pleated wool trousers', 'camel coat', 'suede loafers'], ['cashmere', 'merino', 'wool', 'suede'], ['cream', 'camel', 'taupe', 'navy']],
  ivy_prep: ['Ivy & preppy', 'classic', 'all', 'Button-downs, chinos, cable knits, penny loafers', 'trim collegiate layers', ['oxford button-down', 'cable-knit sweater vest', 'navy blazer', 'chinos', 'penny loafers'], ['oxford cloth', 'cotton twill', 'lambswool'], ['navy', 'white', 'burgundy', 'khaki']],
  sprezzatura: ['Italian sprezzatura', 'classic', 'all', 'Soft unlined blazer, linen, loafers without socks', 'soft-shoulder tailoring, high-rise pleated trousers, worn a little undone', ['unstructured blazer', 'camp-collar shirt', 'knitted polo', 'linen trousers', 'suede loafers'], ['linen', 'cotton', 'fresco wool'], ['ecru', 'tobacco', 'olive', 'sky blue']],
  parisian: ['Parisian chic', 'classic', 'all', 'Breton stripe, trench, straight jeans, flats', 'easy and straight, one sharp piece', ['Breton top', 'trench coat', 'straight jeans', 'black blazer', 'ballet flats or loafers'], ['cotton', 'gabardine', 'denim'], ['navy', 'cream', 'black', 'red']],
  office_siren: ['Office siren', 'classic', 'women', 'Pencil skirt, fitted shirt, slim glasses, kitten heels', 'fitted and long-lined', ['pencil skirt', 'fitted shirt', 'fine-knit cardigan', 'rimless glasses', 'kitten heels'], ['wool', 'poplin', 'fine knit'], ['grey', 'black', 'white', 'burgundy']],
  // ── Academia
  dark_academia: ['Dark academia', 'academia', 'all', 'Tweed, turtlenecks, long wool coats, brogues', 'layered and long, coat over knit', ['tweed blazer', 'turtleneck', 'sweater vest', 'long wool coat', 'leather brogues'], ['tweed', 'wool', 'corduroy', 'leather'], ['brown', 'forest green', 'burgundy', 'charcoal']],
  light_academia: ['Light academia', 'academia', 'all', 'Cream knits, linen shirts, pleated trousers', 'soft and airy, tucked and pleated', ['cream cardigan', 'linen shirt', 'pleated trousers or skirt', 'loafers', 'canvas satchel'], ['linen', 'cotton', 'light wool'], ['cream', 'beige', 'light brown', 'white']],
  poetcore: ['Poetcore', 'academia', 'all', 'Oversized turtleneck, vintage blazer, messenger satchel', 'loose and slightly undone, big knit under an old blazer', ['oversized turtleneck', 'vintage blazer', 'loose trousers', 'messenger satchel', 'long scarf'], ['wool', 'corduroy', 'worn leather'], ['charcoal', 'oat', 'ink blue', 'brown']],
  eclectic_grandpa: ['Eclectic grandpa', 'academia', 'all', 'Thrifted cardigans, patterned vests, odd mixes', 'roomy, mismatched on purpose', ['chunky cardigan', 'patterned sweater vest', 'pleated trousers', 'flat cap', 'loafers with bright socks'], ['lambswool', 'corduroy', 'tweed'], ['mustard', 'brown', 'rust', 'bottle green']],
  // ── Minimal
  scandi_minimal: ['Scandi minimal', 'minimal', 'all', 'One colour, clean lines, nothing extra', 'boxy top, wide straight trousers, one colour head to toe', ['heavy plain tee', 'crew-neck knit', 'wide straight trousers', 'plain leather sneakers'], ['heavy cotton', 'wool', 'leather'], ['black', 'charcoal', 'white', 'grey']],
  japanese_minimal: ['Japanese minimal', 'minimal', 'all', 'Loose layers, natural fabrics, soft drape', 'roomy layers that hang, long over wide', ['collarless shirt', 'long overshirt', 'wide trousers', 'knit vest', 'simple leather shoes'], ['cotton', 'linen', 'wool'], ['ecru', 'ink', 'khaki', 'grey']],
  nineties_minimal: ['’90s minimal', 'minimal', 'all', 'White tanks, slim black trousers, slip dresses, long coats', 'narrow and sharp', ['white tank', 'slim black trousers', 'slip dress', 'long coat', 'square-toe boots'], ['crepe', 'satin', 'wool'], ['black', 'white', 'camel', 'grey']],
  clean_girl: ['Clean girl', 'minimal', 'women', 'Fitted tank, wide trousers, gold hoops, slick bun', 'fitted top, fluid bottom', ['fitted tank', 'wide trousers', 'oversized blazer', 'gold hoops', 'ballet flats'], ['rib knit', 'linen', 'silk'], ['white', 'beige', 'sand', 'gold']],
  normcore: ['Normcore', 'minimal', 'all', 'Plain on purpose: fleece, straight jeans, dad sneakers', 'regular, nothing tailored', ['plain tee', 'fleece', 'straight jeans', 'dad sneakers', 'cap'], ['cotton', 'fleece', 'denim'], ['grey', 'navy', 'white', 'light wash']],
  // ── Tokyo & Seoul
  city_boy: ['City boy', 'tokyo', 'all', 'Tokyo Popeye: oversized button-down, wide chinos, tote', 'big shirt, wide trousers, relaxed', ['oversized button-down', 'wide chinos', 'knit vest', 'canvas tote', 'plain sneakers'], ['oxford cloth', 'cotton twill'], ['navy', 'khaki', 'white', 'pastel stripe']],
  amekaji: ['Amekaji', 'tokyo', 'all', 'Japanese Americana: raw denim, flannel, work boots', 'straight denim, layered shirts and jackets', ['raw selvedge jeans', 'flannel shirt', 'deck jacket', 'heavy loopwheel tee', 'work boots'], ['selvedge denim', 'flannel', 'leather'], ['indigo', 'red check', 'olive', 'brown']],
  japanese_workwear: ['Japanese workwear', 'tokyo', 'all', 'Indigo, sashiko stitching, noragi jackets', 'boxy jackets, loose tapered trousers', ['noragi jacket', 'sashiko patched trousers', 'indigo shirt', 'canvas shoes'], ['indigo cotton', 'linen', 'hemp'], ['indigo', 'ecru', 'black']],
  acubi: ['Acubi', 'tokyo', 'all', 'Seoul minimal grunge: washed grey, slim layers, wide jeans', 'slim layered top, wide washed bottom', ['baby tee or slim knit', 'layered tank', 'wide washed jeans', 'zip hoodie', 'mini bag'], ['jersey', 'denim', 'mesh'], ['grey', 'black', 'white', 'washed blue']],
  harajuku: ['Harajuku', 'tokyo', 'all', 'Bold layers, mixed prints, playful accessories', 'many layers, mixed lengths', ['printed shirt over tee', 'layered skirt or wide trousers', 'patterned socks', 'chunky shoes', 'pins and charms'], ['cotton', 'denim', 'knit'], ['mixed bright', 'black', 'white']],
  // ── Work & outdoor
  workwear: ['Workwear', 'work', 'all', 'Chore coats, double-knee pants, beanies, work boots', 'boxy jacket, straight sturdy trousers', ['chore coat', 'double-knee canvas pants', 'heavy tee', 'watch cap', 'leather work boots'], ['duck canvas', 'denim', 'wool'], ['brown', 'tan', 'navy', 'cream']],
  gorpcore: ['Gorpcore', 'work', 'all', 'Fleece, shells, trail shoes', 'layers: fleece under a shell, relaxed nylon trousers', ['fleece half-zip', 'shell jacket', 'hiking trousers', 'trail shoes', 'crossbody bag'], ['fleece', 'ripstop nylon', 'technical shell'], ['moss', 'stone', 'beige', 'burnt orange']],
  khaki_coded: ['Khaki coded', 'work', 'all', 'Explorer: field jackets, utility shirts, desert neutrals', 'pockets everywhere, relaxed and belted', ['field jacket', 'utility shirt', 'cargo trousers', 'safari vest', 'desert boots'], ['cotton drill', 'canvas', 'suede'], ['khaki', 'sand', 'olive', 'tan']],
  western: ['Western', 'work', 'all', 'Denim on denim, pearl snaps, cowboy boots', 'fitted shirt, bootcut jeans', ['pearl-snap shirt', 'denim jacket', 'bootcut jeans', 'cowboy boots', 'big belt buckle'], ['denim', 'suede', 'leather'], ['indigo', 'tan', 'cream', 'brown']],
  military: ['Military surplus', 'work', 'all', 'M-65, fatigue pants, bomber, combat boots', 'boxy jacket, straight fatigues', ['M-65 field jacket', 'fatigue pants', 'MA-1 bomber', 'plain tee', 'combat boots'], ['cotton sateen', 'nylon', 'leather'], ['olive', 'black', 'khaki']],
  // ── Street
  streetwear: ['Streetwear', 'street', 'all', 'Hoodies, baggy cargos, chunky sneakers', 'oversized top, baggy trousers stacked at the shoe', ['hoodie', 'cargo jeans', 'chunky sneakers', 'beanie', 'graphic tee'], ['fleece', 'washed cotton', 'denim'], ['washed black', 'grey', 'olive', 'white']],
  skater: ['Skater', 'street', 'all', 'Wide jeans, boxy tees, flannel, suede skate shoes', 'boxy and wide, worn in', ['boxy tee', 'flannel shirt', 'baggy jeans or work pants', 'cap', 'suede skate shoes'], ['cotton', 'canvas', 'suede'], ['washed black', 'tan', 'white', 'faded colour']],
  hiphop_90s: ['’90s hip-hop', 'street', 'all', 'Baggy denim, big jerseys, puffers, wheat boots', 'everything big', ['oversized jersey', 'baggy jeans', 'puffer jacket', 'bandana', 'wheat work boots'], ['denim', 'nylon', 'mesh'], ['navy', 'wheat', 'red', 'black']],
  blokecore: ['Blokecore', 'street', 'all', 'Retro football shirt, jeans, terrace trainers', 'regular, shirt over straight jeans', ['retro football shirt', 'straight jeans', 'track jacket', 'low terrace trainers', 'scarf'], ['polyester mesh', 'denim', 'suede'], ['club colours', 'white', 'light wash']],
  // ── Dark & avant-garde
  opium: ['Opium', 'dark', 'all', 'Matte black, leather, flared jeans, silver, big boots', 'fitted top, padded jacket, flared or baggy distressed bottom', ['fitted black top', 'leather or padded jacket', 'flared distressed jeans', 'silver cross jewellery', 'chunky boots'], ['leather', 'washed cotton', 'mesh'], ['black', 'oxblood', 'dark grey', 'silver']],
  dark_avant: ['Dark avant-garde', 'dark', 'all', 'Drapes, long layers, asymmetry, all black', 'long draped layers, drop crotch, sculpted boots', ['long draped top', 'drop-crotch trousers', 'asymmetric coat', 'sculptural boots'], ['jersey', 'wool gabardine', 'leather'], ['black', 'dust', 'grey']],
  archive: ['Archive', 'dark', 'all', '2000s designer: straps, military mods, distressed knits', 'slim and layered, utility details', ['distressed knit', 'strapped jacket', 'military cargo', 'painted denim', 'Chelsea boots'], ['wool', 'nylon', 'denim'], ['black', 'olive', 'grey', 'cream']],
  goth: ['Goth', 'dark', 'all', 'Black velvet, lace, corsetry, platform boots', 'fitted and dramatic', ['velvet blazer or dress', 'lace top', 'black flared trousers', 'corset belt', 'platform boots'], ['velvet', 'lace', 'PVC'], ['black', 'deep purple', 'blood red']],
  grunge: ['Grunge', 'dark', 'all', 'Flannel, ripped jeans, band tee, combat boots', 'loose and layered, worn out', ['flannel shirt', 'band tee', 'ripped jeans', 'long thermal under a tee', 'combat boots'], ['flannel', 'denim', 'worn cotton'], ['faded black', 'plaid red', 'olive']],
  punk: ['Punk', 'dark', 'all', 'Leather jacket, tartan, studs, safety pins', 'tight trousers, short jacket', ['studded leather jacket', 'tartan trousers', 'ripped tee', 'bondage straps', 'boots'], ['leather', 'tartan wool', 'metal'], ['black', 'red tartan', 'silver']],
  indie_sleaze: ['Indie sleaze', 'dark', 'all', '2010s party: skinny jeans, leather jacket, messy hair', 'skinny bottom, slouchy top', ['skinny black jeans', 'leather jacket', 'vintage tee', 'thin scarf', 'worn boots'], ['denim', 'leather', 'jersey'], ['black', 'grey', 'silver']],
  whimsigoth: ['Whimsigoth', 'dark', 'women', '’90s witchy: velvet, moons, long skirts', 'long and flowing, dark', ['velvet slip dress', 'crochet shawl', 'long skirt', 'celestial jewellery', 'lace-up boots'], ['velvet', 'crochet', 'chiffon'], ['plum', 'black', 'moss', 'gold']],
  // ── Future
  techwear: ['Techwear', 'future', 'all', 'Black shells, straps, boots', 'high-collar shell, cargo trousers with straps', ['waterproof shell', 'strap cargo trousers', 'tactical boots', 'sling bag'], ['technical shell', 'nylon', 'rubber'], ['black', 'graphite', 'dark olive']],
  y3k: ['Y3K', 'future', 'all', 'Silver, holographic, sculpted, alien-sleek', 'sleek and sculpted', ['metallic jacket', 'sculpted top', 'silver trousers', 'wraparound shades', 'futuristic sneakers'], ['metallic nylon', 'holographic', 'neoprene'], ['silver', 'chrome', 'icy blue', 'black']],
  cyberpunk: ['Cyberpunk', 'future', 'all', 'PVC, harnesses, neon accents, platform boots', 'fitted and armoured', ['PVC jacket', 'harness', 'cargo trousers', 'neon accent piece', 'platform boots'], ['PVC', 'nylon', 'mesh'], ['black', 'neon green', 'magenta']],
  // ── Soft & romantic
  romantic: ['Romantic', 'soft', 'all', 'Soft shirts, ruffles, pleated trousers', 'full sleeves, soft collar, high waist with pleats', ['flowy shirt', 'ruffled collar', 'pleated trousers', 'polished boots'], ['silk', 'cotton voile', 'velvet'], ['ivory', 'dark brown', 'burgundy', 'black']],
  boho: ['Boho', 'soft', 'all', 'Loose linen, earthy tones, sandals', 'loose and flowing', ['linen shirt', 'drawstring trousers', 'leather sandals', 'bead necklace'], ['linen', 'cotton gauze', 'leather'], ['sand', 'off-white', 'terracotta', 'brown']],
  cottagecore: ['Cottagecore', 'soft', 'all', 'Prairie blouses, florals, hand knits, Mary Janes', 'soft and full', ['prairie blouse', 'floral midi dress', 'hand-knit cardigan', 'straw basket', 'Mary Janes'], ['cotton', 'linen', 'wool'], ['sage', 'cream', 'dusty rose', 'wheat']],
  balletcore: ['Balletcore', 'soft', 'women', 'Wrap tops, tulle, leg warmers, ballet flats', 'close top, floaty skirt', ['wrap top', 'tulle or satin skirt', 'leg warmers', 'leotard', 'ballet flats'], ['jersey', 'tulle', 'satin'], ['ballet pink', 'white', 'black', 'grey']],
  coquette: ['Coquette', 'soft', 'women', 'Bows, lace, ruffles, soft pink', 'short and frilly', ['lace top', 'ribbon bows', 'ruffled mini skirt', 'cropped cardigan', 'Mary Janes'], ['lace', 'satin', 'cotton'], ['pink', 'white', 'red', 'cream']],
  fairycore: ['Fairycore', 'soft', 'women', 'Gauze, puff sleeves, corsets, forest tones', 'airy layers, laced waist', ['puff-sleeve top', 'gauzy layered skirt', 'corset', 'flower accessories', 'soft boots'], ['gauze', 'chiffon', 'lace'], ['moss', 'lilac', 'cream', 'gold']],
  soft_boy: ['Soft boy', 'soft', 'men', 'Pastel knits, cardigans, wide trousers, silver rings', 'loose knit over a tee, wide trousers', ['pastel cardigan', 'striped tee', 'wide trousers', 'silver rings', 'canvas sneakers'], ['knit', 'cotton'], ['lavender', 'sage', 'cream', 'light blue']],
  coastal: ['Coastal', 'soft', 'all', 'Linen, cream knits, straw hats, by the sea', 'relaxed and light', ['linen shirt', 'cream knit', 'white trousers', 'straw hat', 'espadrilles'], ['linen', 'cotton'], ['white', 'sand', 'navy', 'sea blue']],
  // ── Sport
  sport_chic: ['Sport chic', 'sport', 'all', 'Track jackets, joggers, retro runners', 'zip jacket over a tee, tapered joggers', ['track jacket', 'joggers', 'retro running shoes', 'crew socks'], ['jersey', 'nylon', 'suede'], ['navy', 'grey', 'white', 'forest green']],
  tenniscore: ['Tenniscore', 'sport', 'all', 'Country club: whites, cable knits, pleats, clean sneakers', 'crisp and short, knit over the shoulders', ['polo or cricket sweater', 'pleated tennis skirt or shorts', 'cable knit', 'white sneakers', 'visor'], ['cotton piqué', 'cable knit'], ['white', 'cream', 'green', 'navy']],
  run_club: ['Run club', 'sport', 'all', 'Split shorts, tech tees, racing shoes worn as streetwear', 'short and light', ['split running shorts', 'tech tee', 'windbreaker', 'running cap', 'racing shoes'], ['technical mesh', 'nylon'], ['black', 'grey', 'neon accent']],
  athleisure: ['Pilates athleisure', 'sport', 'all', 'Matching sets, leggings or wide joggers, oversized hoodie', 'fitted base, oversized top', ['matching set', 'leggings or wide joggers', 'oversized hoodie', 'clean sneakers', 'cap'], ['rib knit', 'jersey', 'fleece'], ['oat', 'grey', 'black', 'soft pastel']],
  // ── Retro
  y2k: ['Y2K', 'retro', 'all', 'Low-rise baggy denim, ringer tees, tinted shades', 'fitted top, very baggy low-rise jeans', ['ringer tee', 'baggy light-wash jeans', 'small tinted sunglasses', 'silver chain', 'chunky sneakers'], ['denim', 'jersey', 'metal'], ['light wash', 'white', 'baby blue', 'silver']],
  seventies: ['’70s revival', 'retro', 'all', 'Flares, suede, wide collars, earthy tones', 'fitted top, flared bottom', ['flared trousers', 'wide-collar shirt', 'suede jacket', 'knitted vest', 'heeled boots'], ['suede', 'corduroy', 'crochet'], ['rust', 'mustard', 'brown', 'cream']],
  mod: ['’60s mod', 'retro', 'all', 'Slim suits, shift dresses, parkas, Chelsea boots', 'slim and short, graphic', ['slim suit', 'knitted polo', 'shift dress', 'fishtail parka', 'Chelsea boots'], ['mohair', 'wool', 'cotton'], ['black', 'white', 'navy', 'red']],
  rockabilly: ['’50s rockabilly', 'retro', 'all', 'Cuffed jeans, bowling shirts, leather jacket', 'cuffed straight jeans, boxy shirt', ['cuffed raw jeans', 'bowling shirt', 'white tee', 'leather jacket', 'creepers'], ['denim', 'rayon', 'leather'], ['black', 'red', 'cream']],
  // ── Glam & maximal
  glamoratti: ['Glamoratti', 'glam', 'all', '’80s power: big-shoulder suits, funnel necks, chunky gold', 'sculpted shoulders, baggy trousers', ['big-shoulder suit', 'funnel-neck top', 'wide belt', 'chunky gold jewellery', 'pointed shoes'], ['wool', 'satin', 'leather'], ['black', 'chocolate', 'oxblood', 'gold']],
  mob_wife: ['Mob wife', 'glam', 'women', 'Faux fur, leopard, gold, all black underneath', 'fitted black base, big coat', ['faux fur coat', 'leopard print piece', 'black bodysuit', 'gold jewellery', 'heels'], ['faux fur', 'satin', 'leather'], ['black', 'leopard', 'gold', 'red']],
  baddie: ['Baddie', 'glam', 'women', 'Bodycon, crop tops, cargos, sneakers, nails done', 'fitted top, fitted or cargo bottom', ['bodycon dress', 'crop top', 'cargo trousers', 'chunky sneakers', 'small shoulder bag'], ['stretch jersey', 'rib knit', 'nylon'], ['black', 'beige', 'brown', 'white']],
  maximalist: ['Maximalist', 'glam', 'all', 'Clashing prints, colour, layers, statement pieces', 'many layers, bold mix', ['print shirt', 'patterned trousers', 'colourful knit', 'layered jewellery', 'statement shoes'], ['silk', 'jacquard', 'knit'], ['bold mix', 'gold', 'emerald', 'pink']]
} satisfies Record<string, Row>

export type StyleId = keyof typeof ROWS

export const STYLES = Object.fromEntries(
  Object.entries(ROWS).map(([id, [name, family, who, line, silhouette, pieces, fabrics, colors]]) => [id, { id, name, family, for: who, line, silhouette, pieces, fabrics, colors }])
) as Record<StyleId, StyleGuide>

export const STYLE_IDS = Object.keys(ROWS) as StyleId[]

const isStyleId = (v: unknown): v is StyleId => typeof v === 'string' && Object.hasOwn(ROWS, v)

/** Стили семейства для опроса: шаг 1 — семейства, шаг 2 — стили внутри понравившихся */
export function stylesIn(family: StyleFamily, who: 'women' | 'men' | 'all' = 'all'): StyleGuide[] {
  return STYLE_IDS.map((id) => STYLES[id]).filter((s) => s.family === family && (who === 'all' || s.for === 'all' || s.for === who))
}

/** Семейства, которые не смешиваем, если человек сам не попросил (old money ≠ спортивки с батником) */
const CLASH_FAMILIES: [StyleFamily, StyleFamily][] = [
  ['classic', 'street'],
  ['classic', 'dark'],
  ['classic', 'future'],
  ['academia', 'street'],
  ['academia', 'future'],
  ['minimal', 'glam'],
  ['soft', 'future'],
  ['work', 'glam']
]

export function clashesWith(id: StyleId): StyleId[] {
  const f = STYLES[id].family
  const families = CLASH_FAMILIES.flatMap(([a, b]) => (a === f ? [b] : b === f ? [a] : []))
  return STYLE_IDS.filter((other) => families.includes(STYLES[other].family))
}

export type StyleVote = 'love' | 'like' | 'skip'

/** Профиль стиля: 1–3 стиля с весами (сумма 100), цвета, чего избегает */
export interface StyleProfile {
  styles: { id: StyleId; weight: number }[]
  colors: string[]
  avoid: StyleId[]
}

const POINTS: Record<StyleVote, number> = { love: 2, like: 1, skip: 0 }

/** Из ответов опроса. Никто не понравился — профиля нет (null), а не «всего понемногу» */
export function profileFromVotes(votes: Partial<Record<StyleId, StyleVote>>): StyleProfile | null {
  const scored = STYLE_IDS.map((id) => ({ id, points: POINTS[votes[id] ?? 'skip'] }))
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || STYLE_IDS.indexOf(a.id) - STYLE_IDS.indexOf(b.id))
    .slice(0, 3)
  if (!scored.length) return null
  const styles = withWeights(scored)
  const chosen = new Set(styles.map((s) => s.id))
  // избегаем то, что против выбранного стиля и что человек сам пролистал
  const avoid = [...new Set(styles.flatMap((s) => clashesWith(s.id)))].filter((id) => !chosen.has(id) && votes[id] === 'skip')
  return { styles, colors: colorsFor(styles), avoid }
}

/** Демо-аккаунт: готовый ответ на опрос — под него собраны демо-образы, судья сразу видит «In your style» */
export const DEMO_STYLE: StyleProfile = profileFromVotes({ nineties_minimal: 'love', military: 'like', scandi_minimal: 'like' })!

/** Веса в процентах, сумма ровно 100 (остаток от округления — главному стилю) */
function withWeights(scored: { id: StyleId; points: number }[]): StyleProfile['styles'] {
  const total = scored.reduce((sum, s) => sum + s.points, 0)
  const styles = scored.map((s) => ({ id: s.id, weight: Math.round((s.points / total) * 100) }))
  styles[0].weight += 100 - styles.reduce((sum, s) => sum + s.weight, 0)
  return styles
}

/** Цвета по очереди из каждого стиля, главный — первым; не больше 4 */
function colorsFor(styles: StyleProfile['styles']): string[] {
  const lists = styles.map((s) => STYLES[s.id].colors)
  const out: string[] = []
  for (let i = 0; out.length < 4 && i < 4; i++) for (const l of lists) if (l[i] && !out.includes(l[i]) && out.length < 4) out.push(l[i])
  return out
}

/** Профиль из сохранённого документа: чужое и сломанное отбрасываем */
export function cleanStyle(raw: unknown): StyleProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<StyleProfile>
  const styles = Array.isArray(r.styles) ? r.styles.filter((s) => s && isStyleId(s.id) && typeof s.weight === 'number' && s.weight > 0).slice(0, 3) : []
  if (!styles.length) return null
  const fixed = withWeights(styles.map((s) => ({ id: s.id, points: s.weight })))
  const chosen = new Set(fixed.map((s) => s.id))
  const avoid = Array.isArray(r.avoid) ? [...new Set(r.avoid.filter(isStyleId))].filter((id) => !chosen.has(id)) : []
  const colors = Array.isArray(r.colors) ? r.colors.filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length < 30).slice(0, 4) : colorsFor(fixed)
  return { styles: fixed, colors, avoid }
}

/** Насколько образ в стиле человека, 0–100: сумма весов его стилей; стиль из «избегаю» — сразу 0 */
export function styleMatch(tags: StyleId[], profile: StyleProfile | null): number {
  if (!profile || tags.some((t) => profile.avoid.includes(t))) return 0
  return Math.min(100, profile.styles.filter((s) => tags.includes(s.id)).reduce((sum, s) => sum + s.weight, 0))
}

/** «Old money · Poetcore · City boy» */
export function styleLine(profile: StyleProfile): string {
  return profile.styles.map((s) => STYLES[s.id].name).join(' · ')
}

/** Для сборки образов (Muse Spark): стиль человека и правило «не скучная база» */
export function stylePrompt(profile: StyleProfile | null): string {
  const live = 'No plain basics unless they ask (white tee and blue jeans): every outfit has one live detail — a silhouette, layers, an accent or a texture.'
  if (!profile) return live
  const guides = profile.styles.map((s) => {
    const g = STYLES[s.id]
    return `${g.name} (${s.weight}%): ${g.silhouette}; pieces like ${g.pieces.join(', ')}; ${g.fabrics.join(', ')}.`
  })
  const avoid = profile.avoid.length ? ` Leave out ${profile.avoid.map((id) => STYLES[id].name.toLowerCase()).join(', ')} unless they ask.` : ''
  return [`Their style: ${guides.join(' ')}`, `Colours they like: ${profile.colors.join(', ')}.${avoid}`, live].join('\n')
}
