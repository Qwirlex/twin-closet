// Склейка примерки (PLAN.md, 3.1): меняется только одежда, лицо, волосы, кисти и фон — настоящие пиксели твоего фото.
// Muse Image перерисовывает картинку целиком и в своём разрешении, поэтому:
// 1) выравниваем генерацию по фигуре (маски «person» от SAM на оригинале и на результате);
// 2) зона одежды = старая одежда ∪ новая одежда − защищённая зона (лицо, волосы, кисти);
// 3) подгоняем цвет вставки по полосе вокруг зоны; 4) вклеиваем с мягким краем.
import { area, bbox, binary, blur, dilate, erode, intersect, iou, mask, resize, subtract, union, warpImg, warpMask, type Img, type Mask } from './raster'

/** Ниже этого совпадения фигур вариант выбрасываем: фигура «уехала» */
export const MIN_IOU = 0.92

export interface TryOnInput {
  /** твоё фото (ракурс скана) */
  original: Img
  /** вариант от Muse Image — любой размер */
  generated: Img
  /** SAM на оригинале: человек целиком, защищённая зона (face + hair + hand), одежда, которую меняем */
  personOrig: Mask
  protectedOrig: Mask
  clothesOrig: Mask
  /** SAM на генерации (в её координатах): человек и новая одежда */
  personGen: Mask
  clothesGen: Mask
}

export interface Alignment {
  scale: number
  dx: number
  dy: number
  /** совпадение силуэтов после выравнивания */
  iou: number
  /** совпадение открытого тела (силуэт без одежды: голова, шея, кисти) — не зависит от фасона новой вещи */
  bodyIou: number | null
}

export interface TryOnReport extends Alignment {
  accepted: boolean
  reason: string | null
  /** доля кадра, взятая из генерации */
  changed: number
  /** перенос цвета: множитель и сдвиг по каналам R, G, B */
  color: { gain: [number, number, number]; offset: [number, number, number] } | null
  /** сколько пикселей защищённой зоны отличается от оригинала — должно быть 0 */
  protectedChanged: number
}

/**
 * Масштаб и сдвиг генерации к оригиналу: сначала по рамкам фигур, потом перебор вокруг на уменьшенных масках
 * (грубо, затем точно). Цель — совпадение силуэта и открытого тела: широкие джинсы меняют силуэт, а голова и кисти — нет.
 */
export function align(personOrig: Mask, personGen: Mask, bodyOrig?: Mask, bodyGen?: Mask): Alignment {
  const bo = bbox(personOrig)
  const bg = bbox(personGen)
  if (!bo || !bg) return { scale: 1, dx: 0, dy: 0, iou: 0, bodyIou: null }
  const s0 = (bo.y1 - bo.y0 + 1) / (bg.y1 - bg.y0 + 1)
  const dx0 = (bo.x0 + bo.x1 + 1) / 2 - s0 * ((bg.x0 + bg.x1 + 1) / 2)
  const dy0 = (bo.y0 + bo.y1 + 1) / 2 - s0 * ((bg.y0 + bg.y1 + 1) / 2)
  const W0 = personOrig.width
  const H0 = personOrig.height
  const useBody = !!bodyOrig && !!bodyGen && area(bodyOrig) > 0.005 * W0 * H0 && area(bodyGen) > 0.005 * personGen.width * personGen.height

  // уменьшенная копия: длинная сторона ~200 px — перебор быстрый
  const k = Math.min(1, 200 / Math.max(W0, H0))
  const W = Math.max(8, Math.round(W0 * k))
  const H = Math.max(8, Math.round(H0 * k))
  const smallPerson = binary(resize(personOrig, W, H))
  const smallBody = useBody ? binary(resize(bodyOrig!, W, H)) : null
  const score = (s: number, dx: number, dy: number) => {
    const p = iou(smallPerson, warpMask(personGen, s * k, dx * k, dy * k, W, H))
    return smallBody ? (p + iou(smallBody, warpMask(bodyGen!, s * k, dx * k, dy * k, W, H))) / 2 : p
  }

  let best = { scale: s0, dx: dx0, dy: dy0, v: score(s0, dx0, dy0) }
  const search = (ds: number[], dd: number[]) => {
    const c = { ...best }
    for (const a of ds) for (const bx of dd) for (const by of dd) {
      const s = c.scale * (1 + a)
      const v = score(s, c.dx + bx, c.dy + by)
      if (v > best.v) best = { scale: s, dx: c.dx + bx, dy: c.dy + by, v }
    }
  }
  const step = 1 / k // один пиксель уменьшенной копии в пикселях оригинала
  search([-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03], [-4, -2, 0, 2, 4].map((v) => v * step))
  search([-0.005, 0, 0.005], [-1, 0, 1].map((v) => v * step))
  search([-0.0025, 0, 0.0025], [-0.5, 0, 0.5].map((v) => v * step))

  // итог — в полном разрешении
  const { scale, dx, dy } = best
  return {
    scale,
    dx,
    dy,
    iou: iou(binary(personOrig), warpMask(personGen, scale, dx, dy, W0, H0)),
    bodyIou: useBody ? iou(binary(bodyOrig!), warpMask(bodyGen!, scale, dx, dy, W0, H0)) : null
  }
}

/** Перенос среднего и разброса цвета по полосе, где оба снимка должны совпадать (кожа, фон у края одежды) */
export function colorTransfer(original: Img, generated: Img, band: Mask): TryOnReport['color'] {
  const n = area(band)
  if (n < 200) return null
  const sum = [0, 0, 0, 0, 0, 0]
  const sq = [0, 0, 0, 0, 0, 0]
  for (let i = 0; i < band.data.length; i++) {
    if (band.data[i] < 0.5) continue
    for (let c = 0; c < 3; c++) {
      const o = original.data[i * 3 + c]
      const g = generated.data[i * 3 + c]
      sum[c] += o
      sq[c] += o * o
      sum[c + 3] += g
      sq[c + 3] += g * g
    }
  }
  const gain: [number, number, number] = [1, 1, 1]
  const offset: [number, number, number] = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const mo = sum[c] / n
    const mg = sum[c + 3] / n
    const so = Math.sqrt(Math.max(1, sq[c] / n - mo * mo))
    const sg = Math.sqrt(Math.max(1, sq[c + 3] / n - mg * mg))
    // осторожно: сильная поправка значит, что полоса неудачная, а не что свет другой
    gain[c] = Math.max(0.8, Math.min(1.25, so / sg))
    offset[c] = Math.max(-40, Math.min(40, mo - gain[c] * mg))
  }
  return { gain, offset }
}

export interface TryOnResult {
  image: Img
  /** какая доля пикселя взята из генерации (для отладки и превью) */
  blend: Mask
  report: TryOnReport
}

export function composeTryOn(input: TryOnInput): TryOnResult {
  const { original, generated } = input
  const W = original.width
  const H = original.height
  const side = Math.max(W, H)
  const feather = Math.max(2, Math.round(side / 200)) // ~6 px на 1280
  const fail = (reason: string, a: Alignment): TryOnResult => ({
    image: { width: W, height: H, data: new Uint8ClampedArray(original.data) },
    blend: mask(W, H),
    report: { ...a, accepted: false, reason, changed: 0, color: null, protectedChanged: 0 }
  })

  const bodyOrig = subtract(binary(input.personOrig), binary(input.clothesOrig))
  const bodyGen = subtract(binary(input.personGen), binary(input.clothesGen))
  const found = align(input.personOrig, input.personGen, bodyOrig, bodyGen)
  const clothesNew = binary(warpMask(input.clothesGen, found.scale, found.dx, found.dy, W, H))

  // Поза — по открытому телу вне одежды на обоих снимках: куртка вместо футболки закрывает руки — это не «другая поза».
  // Если открытого тела почти нет — по силуэту целиком
  const stableOrig = subtract(bodyOrig, clothesNew)
  const stableGen = subtract(binary(warpMask(bodyGen, found.scale, found.dx, found.dy, W, H)), binary(input.clothesOrig))
  const stable = area(stableOrig) > 0.005 * W * H ? iou(stableOrig, stableGen) : null
  const a: Alignment = { ...found, bodyIou: stable }
  const overlap = stable ?? a.iou
  if (overlap < MIN_IOU) return fail(`Figure moved: overlap ${(overlap * 100).toFixed(1)}% < ${MIN_IOU * 100}%`, a)

  const { img: gen, valid } = warpImg(generated, a.scale, a.dx, a.dy, W, H)
  const protect = binary(input.protectedOrig)
  // защищённую зону чуть расширяем: на её краю тоже остаётся оригинал
  const keep = dilate(protect, Math.max(1, Math.round(feather / 2)))

  const zoneHard = intersect(subtract(union(binary(input.clothesOrig), clothesNew), keep), binary(valid, 0.999))
  if (area(zoneHard) < 0.002 * W * H) return fail('Nothing to change: the clothing zone is empty', a)

  // мягкий край внутрь зоны, защищённая зона — строго 0
  const blend = subtract(blur(erode(zoneHard, Math.round(feather / 2)), feather), protect)

  // цвет: полоса вокруг зоны, где генерация должна совпадать с оригиналом (фон, шея, руки).
  // Защищённую зону в полосу не берём: лицо на генерации модель могла изменить — по нему цвет не мерим
  const ring = subtract(intersect(subtract(dilate(zoneHard, feather * 3), dilate(zoneHard, feather)), binary(valid, 0.999)), dilate(protect, feather))
  const color = colorTransfer(original, gen, ring)

  const out = new Uint8ClampedArray(original.data)
  let changed = 0
  for (let i = 0; i < W * H; i++) {
    const t = blend.data[i]
    if (t <= 0.001) continue
    changed++
    for (let c = 0; c < 3; c++) {
      const g = color ? gen.data[i * 3 + c] * color.gain[c] + color.offset[c] : gen.data[i * 3 + c]
      out[i * 3 + c] = original.data[i * 3 + c] * (1 - t) + g * t
    }
  }

  let protectedChanged = 0
  for (let i = 0; i < W * H; i++) {
    if (protect.data[i] < 0.5) continue
    if (out[i * 3] !== original.data[i * 3] || out[i * 3 + 1] !== original.data[i * 3 + 1] || out[i * 3 + 2] !== original.data[i * 3 + 2]) protectedChanged++
  }

  return { image: { width: W, height: H, data: out }, blend, report: { ...a, accepted: true, reason: null, changed: changed / (W * H), color, protectedChanged } }
}
