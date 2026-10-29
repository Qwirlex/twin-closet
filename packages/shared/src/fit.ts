// Посадка по зонам (docs/spec-fit.md): запас = замер вещи − замер тела, каждая зона отдельно.
// Ярлык размера на всё тело не вешаем никогда; совет — соседний размер или другой крой, а не «бери побольше»
import type { GarmentKind } from './index'

/** inseam — длина по внутреннему шву; бедро у тела оцениваем по бёдрам */
export const FIT_ZONES = ['chest', 'waist', 'hips', 'thigh', 'inseam'] as const
export type FitZone = (typeof FIT_ZONES)[number]

/** Параметры тела: только по желанию, всё в см и кг (на экране — см или дюймы) */
export interface BodyMeasurements {
  heightCm: number | null
  weightKg: number | null
  chestCm: number | null
  waistCm: number | null
  hipsCm: number | null
  inseamCm: number | null
  shoeEu: number | null
}

export const EMPTY_BODY: BodyMeasurements = { heightCm: null, weightKg: null, chestCm: null, waistCm: null, hipsCm: null, inseamCm: null, shoeEu: null }

/** Что вне этих границ — опечатка (1830 вместо 183) */
export const BODY_LIMITS: Record<keyof BodyMeasurements, [number, number]> = {
  heightCm: [120, 230],
  weightKg: [30, 250],
  chestCm: [60, 160],
  waistCm: [45, 160],
  hipsCm: [60, 170],
  inseamCm: [50, 110],
  shoeEu: [30, 50]
}

/** Параметры из памяти или с сервера: мусор и опечатки — null */
export function cleanBody(raw: unknown): BodyMeasurements | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out = { ...EMPTY_BODY }
  for (const key of Object.keys(BODY_LIMITS) as (keyof BodyMeasurements)[]) {
    const v = r[key]
    const [lo, hi] = BODY_LIMITS[key]
    out[key] = typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null
  }
  return out
}

export type FitCut = 'slim' | 'regular' | 'relaxed' | 'wide' | 'oversize'

/** Замеры вещи: таблица магазина, лист A4, сантиметр или демо. Обхваты — вокруг тела, как в таблицах размеров */
export interface GarmentFit {
  cut: FitCut
  /** эластан, трикотаж: допустимый минус больше */
  stretch: boolean
  /** размер, который человек смотрит (с бирки, скриншота, страницы) */
  size: string
  /** от меньшего к большему */
  sizes: { size: string; zones: Partial<Record<FitZone, number>> }[]
  source: 'chart' | 'a4' | 'tape' | 'demo'
}

export type FitVerdict = 'tight' | 'snug' | 'right' | 'relaxed' | 'loose'
/** good — как задумано, note — к сведению, problem — не сядет */
export type FitTone = 'good' | 'note' | 'problem'

export interface ZoneFit {
  zone: FitZone
  roomCm: number
  verdict: FitVerdict
  /** «Relaxed, as cut», «Light break at the shoe» */
  label: string
  /** для метки на фото: «tight», «+2 cm» */
  short: string
  tone: FitTone
  /** цифра тела оценена (бедро по бёдрам) */
  estimated: boolean
}

export interface FitReport {
  size: string
  zones: ZoneFit[]
  /** у вещи есть замер, у тела нет цифры */
  missing: FitZone[]
  problems: number
  title: string
  summary: string
  advice: string | null
  vsFavorite: string | null
}

export const ZONE_NAME: Record<FitZone, string> = { chest: 'chest', waist: 'waist', hips: 'hips', thigh: 'thigh', inseam: 'length' }

/** Какие зоны важны для вида вещи */
export function zonesFor(kind: GarmentKind | null): FitZone[] {
  if (kind === 'bottom') return ['waist', 'hips', 'thigh', 'inseam']
  if (kind === 'dress') return ['chest', 'waist', 'hips']
  if (kind === 'top' || kind === 'outerwear') return ['chest']
  return []
}

/** Нормальный запас по крою, см вокруг тела */
const RANGE: Record<Exclude<FitZone, 'inseam'>, Record<FitCut, [number, number]>> = {
  chest: { slim: [4, 8], regular: [8, 14], relaxed: [12, 20], wide: [16, 28], oversize: [18, 32] },
  waist: { slim: [0, 4], regular: [0, 4], relaxed: [0, 5], wide: [0, 5], oversize: [0, 6] },
  hips: { slim: [2, 6], regular: [4, 8], relaxed: [6, 12], wide: [8, 16], oversize: [10, 20] },
  thigh: { slim: [3, 7], regular: [5, 10], relaxed: [8, 14], wide: [12, 24], oversize: [12, 24] }
}

/** Обхват бедра у человека ≈ 0,6 обхвата бёдер — пока его не мерят отдельно */
const THIGH_PER_HIP = 0.6

const AS_CUT: Record<FitCut, string> = { slim: 'Slim, as cut', regular: 'Just right', relaxed: 'Relaxed, as cut', wide: 'Relaxed, as cut', oversize: 'Oversized, as cut' }

function bodyZone(body: BodyMeasurements | null, zone: FitZone): { cm: number; estimated: boolean } | null {
  if (!body) return null
  const at = (cm: number | null, estimated = false) => (cm ? { cm, estimated } : null)
  if (zone === 'chest') return at(body.chestCm)
  if (zone === 'waist') return at(body.waistCm)
  if (zone === 'hips') return at(body.hipsCm)
  if (zone === 'thigh') return body.hipsCm ? at(Math.round(body.hipsCm * THIGH_PER_HIP), true) : null
  return at(body.inseamCm)
}

/** Вердикт одной зоны по запасу (для длины — длина вещи по шву минус длина ноги) */
export function zoneFit(zone: FitZone, room: number, cut: FitCut, stretch: boolean, estimated = false): ZoneFit {
  const r = Math.round(room)
  const signed = `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)} cm`
  const base = { zone, roomCm: r, estimated }
  if (zone === 'inseam') {
    if (r < -3) return { ...base, verdict: 'tight', label: 'Ends above the ankle', short: signed, tone: 'problem' }
    if (r <= 1) return { ...base, verdict: 'right', label: 'Right length', short: 'right length', tone: 'good' }
    if (r <= 4) return { ...base, verdict: 'relaxed', label: 'Light break at the shoe', short: signed, tone: 'note' }
    return cut === 'wide' || cut === 'oversize'
      ? { ...base, verdict: 'loose', label: 'Pools at the shoe, as cut', short: signed, tone: 'note' }
      : { ...base, verdict: 'loose', label: 'Stacks at the ankle', short: signed, tone: 'problem' }
  }
  const [min, max] = RANGE[zone][cut]
  if (r < (stretch ? -3 : 0)) return { ...base, verdict: 'tight', label: 'Tight', short: 'tight', tone: 'problem' }
  if (r < min) return { ...base, verdict: 'snug', label: stretch ? 'Snug, the fabric gives' : 'Snug', short: 'snug', tone: 'note' }
  if (r <= max) {
    const wideLeg = zone === 'thigh' && (cut === 'wide' || cut === 'oversize')
    const verdict: FitVerdict = wideLeg ? 'loose' : zone === 'waist' || cut === 'slim' || cut === 'regular' ? 'right' : 'relaxed'
    const label = wideLeg ? 'Wide leg, as cut' : zone === 'waist' ? 'Just right' : AS_CUT[cut]
    const short = wideLeg ? 'wide' : verdict === 'right' ? 'just right' : cut === 'oversize' ? 'oversized' : 'relaxed'
    return { ...base, verdict, label, short, tone: 'good' }
  }
  if (zone === 'waist') return { ...base, verdict: 'loose', label: 'Loose, needs a belt', short: 'loose', tone: 'problem' }
  if (r <= max + 4) return { ...base, verdict: 'relaxed', label: 'Roomier than the cut', short: 'roomy', tone: 'note' }
  return { ...base, verdict: 'loose', label: 'Loose', short: 'loose', tone: 'note' }
}

function sizeZones(fit: GarmentFit, size: string): Partial<Record<FitZone, number>> | null {
  return fit.sizes.find((s) => s.size === size)?.zones ?? null
}

function evalSize(kind: GarmentKind | null, fit: GarmentFit, size: string, body: BodyMeasurements | null): ZoneFit[] {
  const chart = sizeZones(fit, size)
  return zonesFor(kind).flatMap((zone) => {
    const g = chart?.[zone]
    const b = bodyZone(body, zone)
    return g != null && b ? [zoneFit(zone, g - b.cm, fit.cut, fit.stretch, b.estimated)] : []
  })
}

const byZone = (a: FitZone, b: FitZone) => FIT_ZONES.indexOf(a) - FIT_ZONES.indexOf(b)

function list(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

function problemText(z: ZoneFit): string {
  if (z.zone === 'inseam') return z.verdict === 'tight' ? `Ends ${Math.abs(z.roomCm)} cm above the ankle.` : `${z.roomCm} cm too long — stacks at the ankle.`
  return z.verdict === 'tight' ? `Tight at the ${ZONE_NAME[z.zone]} by ${Math.abs(z.roomCm)} cm.` : `Loose at the ${ZONE_NAME[z.zone]} — needs a belt.`
}

const isKeyProblem = (z: ZoneFit) => z.zone !== 'inseam' && z.tone === 'problem'

/** Соседний размер, где все обхваты садятся; иначе — честно про крой */
function adviceFor(kind: GarmentKind | null, fit: GarmentFit, body: BodyMeasurements | null, showSize: boolean, current: ZoneFit[]): string | null {
  const now = current.filter(isKeyProblem)
  if (!now.length) {
    const length = current.find((z) => z.zone === 'inseam' && z.tone === 'problem')
    if (!length) return null
    return length.verdict === 'tight' ? 'Look for a longer leg, or wear them cropped on purpose.' : 'Ask for a shorter leg, or have them hemmed.'
  }
  const at = fit.sizes.findIndex((s) => s.size === fit.size)
  const near = fit.sizes
    .map((s, i) => ({ size: s.size, d: i - at }))
    .filter((c) => c.d !== 0)
    .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || b.d - a.d)
  const involved = new Set(now.map((z) => z.zone))
  for (const c of near) {
    const zones = evalSize(kind, fit, c.size, body)
    const bad = zones.filter(isKeyProblem)
    bad.forEach((z) => involved.add(z.zone))
    if (bad.length) continue
    const keep = zones.find((z) => z.zone !== 'inseam' && z.tone === 'good' && !now.some((p) => p.zone === z.zone))
    const steps = Math.abs(c.d) === 1 ? 'One size' : Math.abs(c.d) === 2 ? 'Two sizes' : 'A few sizes'
    const sizeText = showSize ? c.size : `${steps} ${c.d > 0 ? 'up' : 'down'}`
    const keepWord = keep ? (keep.short === 'wide' ? 'wide' : keep.verdict) : ''
    const keepText = keep ? `, and the ${ZONE_NAME[keep.zone]} ${keep.zone === 'hips' ? 'stay' : 'stays'} ${keepWord}` : ''
    return `${sizeText} fits your ${list(now.map((z) => ZONE_NAME[z.zone]))}${keepText}.`
  }
  const names = [...involved].sort(byZone).map((z) => ZONE_NAME[z])
  return names.length > 1
    ? `In this cut no size fits your ${list(names)} at once. A relaxed or curve fit, or a piece with stretch, will.`
    : `No size of this cut fits your ${names[0]}. A different cut, or a piece with stretch, will.`
}

function vsFavorite(kind: GarmentKind | null, fit: GarmentFit, favorite: FitOptions['favorite']): string | null {
  if (!favorite) return null
  const g = sizeZones(fit, fit.size)
  const f = sizeZones(favorite.fit, favorite.fit.size)
  const parts = zonesFor(kind).flatMap((zone) => {
    const a = g?.[zone]
    const b = f?.[zone]
    if (a == null || b == null) return []
    const d = Math.round(a - b)
    if (Math.abs(d) < 1.5) return []
    return [zone === 'inseam' ? `${Math.abs(d)} cm ${d > 0 ? 'longer' : 'shorter'}` : `${Math.abs(d)} cm ${d > 0 ? 'roomier' : 'tighter'} in the ${ZONE_NAME[zone]}`]
  })
  return parts.length ? `Next to your ${favorite.name}: ${parts.slice(0, 2).join(', ')}.` : `Same fit as your ${favorite.name}.`
}

export interface FitOptions {
  body: BodyMeasurements | null
  /** любимая вещь того же вида: с ней сравниваем */
  favorite?: { name: string; fit: GarmentFit } | null
  /** «Show my size» в Me: выключено — ни букв, ни чисел размеров */
  showSize: boolean
}

/** Посадка вещи на человеке: зоны, итог, совет и сравнение с любимой вещью */
export function fitReport(kind: GarmentKind | null, fit: GarmentFit, o: FitOptions): FitReport {
  const zones = evalSize(kind, fit, fit.size, o.body)
  const chart = sizeZones(fit, fit.size)
  const missing = zonesFor(kind).filter((z) => chart?.[z] != null && !bodyZone(o.body, z))
  const problems = zones.filter((z) => z.tone === 'problem')
  const notes = zones.filter((z) => z.tone === 'note')
  const title = !zones.length ? 'Fit needs your measurements' : !problems.length ? 'Fits' : problems.length === 1 ? 'Fits, with one catch' : "Won't fit as is"
  const summary = problems.length
    ? problems.map(problemText).join(' ')
    : zones.length
      ? notes.length
        ? `${notes[0].label}.`
        : 'Sits the way the cut intends.'
      : 'Add your measurements to see how it sits.'
  return {
    size: fit.size,
    zones,
    missing,
    problems: problems.length,
    title,
    summary,
    advice: adviceFor(kind, fit, o.body, o.showSize, zones),
    vsFavorite: vsFavorite(kind, fit, o.favorite)
  }
}

// ── Любимая вещь, замер сантиметром (docs/spec-favorite-piece.md) ─────────────────

export interface TapeZone {
  zone: FitZone
  label: string
  hint: string
  /** мерим плашмя поперёк — обхват вдвое больше; длина по шву — как есть */
  flat: boolean
}

const TAPE: Record<FitZone, TapeZone> = {
  chest: { zone: 'chest', label: 'Chest, flat', hint: 'Armpit to armpit, straight across the front.', flat: true },
  waist: { zone: 'waist', label: 'Waist, flat', hint: 'Along the top of the waistband, buttoned.', flat: true },
  hips: { zone: 'hips', label: 'Hips, flat', hint: 'Straight across at the widest point, about 18 cm below the waistband.', flat: true },
  thigh: { zone: 'thigh', label: 'Thigh, flat', hint: 'Across one leg, 2–3 cm below the crotch seam.', flat: true },
  inseam: { zone: 'inseam', label: 'Inside leg', hint: 'From the crotch seam to the hem, along the inside.', flat: false }
}

/** Что мерить у вещи этого вида, разложив её на полу */
export function TAPE_ZONES(kind: GarmentKind | null): TapeZone[] {
  return zonesFor(kind).map((z) => TAPE[z])
}

/** Разумные замеры плашмя, см (длина по шву — сама длина) */
export const TAPE_LIMITS: Record<FitZone, [number, number]> = { chest: [35, 90], waist: [25, 80], hips: [30, 90], thigh: [15, 50], inseam: [50, 100] }

/** Замеры плашмя → замеры вещи, как в таблице размеров: поперёк × 2 = обхват. Вне пределов — ошибка, вещь не сохраняем */
export function garmentFitFromTape(kind: GarmentKind | null, flat: Partial<Record<FitZone, number>>, cut: FitCut, stretch: boolean): { fit: GarmentFit | null; errors: FitZone[] } {
  const zones: Partial<Record<FitZone, number>> = {}
  const errors: FitZone[] = []
  for (const t of TAPE_ZONES(kind)) {
    const v = flat[t.zone]
    if (v == null) continue
    const [lo, hi] = TAPE_LIMITS[t.zone]
    if (!Number.isFinite(v) || v < lo || v > hi) errors.push(t.zone)
    else zones[t.zone] = Math.round((t.flat ? v * 2 : v) * 2) / 2
  }
  if (errors.length || !Object.keys(zones).length) return { fit: null, errors }
  return { fit: { cut, stretch, size: 'Yours', source: 'tape', sizes: [{ size: 'Yours', zones }] }, errors: [] }
}

/** Посадка словами для промпта примерки: Muse Image рисует вещь так, как она сядет */
export function fitPrompt(report: FitReport): string {
  return report.zones
    .map((z) => (z.zone === 'inseam' ? z.label.toLowerCase().replace(', as cut', '') : z.short === 'wide' ? 'wide through the leg' : `${z.short} at the ${ZONE_NAME[z.zone]}`))
    .join('; ')
}

export const cmToIn = (cm: number): number => Math.round((cm / 2.54) * 2) / 2
export const inToCm = (inch: number): number => Math.round(inch * 2.54)
export const kgToLb = (kg: number): number => Math.round(kg * 2.20462)
export const lbToKg = (lb: number): number => Math.round(lb / 2.20462)
