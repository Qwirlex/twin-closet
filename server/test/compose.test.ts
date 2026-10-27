import { describe, expect, it } from 'vitest'
import { align, composeTryOn, MIN_IOU } from '../src/tryon/compose'
import { blur, dilate, erode, iou, mask, warpMask, type Img, type Mask } from '../src/tryon/raster'

// Синтетическая сцена 240×320: человек в полный рост на сером градиенте.
// Генерация рисуется «как модель»: в своём разрешении, со сдвигом и масштабом, другим лицом и общим цветовым сдвигом.
type RGB = [number, number, number]
const W = 240
const H = 320
const SKIN: RGB = [200, 160, 130]
const OLD_SHIRT: RGB = [110, 110, 110]
const OLD_PANTS: RGB = [30, 30, 40]
const NEW_JACKET: RGB = [60, 100, 50]
const NEW_PANTS: RGB = [120, 150, 200]

interface Figure {
  face: RGB
  shirt: RGB
  pants: RGB
  /** новая куртка закрывает руки до запястья */
  sleeves?: boolean
  /** другая поза: руки подняты, голова сдвинута */
  pose?: 'raised'
}

/** Что в точке (x, y) канонической сцены: цвет и к каким маскам относится */
function at(f: Figure, x: number, y: number): { c: RGB; person: boolean; protect: boolean; clothes: boolean } {
  const bg: RGB = [50 + (y / H) * 30, 52 + (y / H) * 30, 55 + (y / H) * 30]
  const head = f.pose === 'raised' ? [150, 55] : [120, 60]
  const inCircle = (cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  const inRect = (x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1
  if (inCircle(head[0], head[1], 22)) return { c: f.face, person: true, protect: true, clothes: false }
  const armY = f.pose === 'raised' ? [20, 90] : [90, 175]
  const hands = f.pose === 'raised' ? [[77, 15], [162, 15]] : [[77, 182], [162, 182]]
  for (const [hx, hy] of hands) if (inCircle(hx, hy, 8)) return { c: SKIN, person: true, protect: true, clothes: false }
  if (inRect(110, 80, 130, 86)) return { c: SKIN, person: true, protect: false, clothes: false } // шея
  if (inRect(85, 86, 155, 180)) return { c: f.shirt, person: true, protect: false, clothes: true }
  if (inRect(70, armY[0], 84, armY[1]) || inRect(156, armY[0], 170, armY[1])) {
    return f.sleeves ? { c: f.shirt, person: true, protect: false, clothes: true } : { c: SKIN, person: true, protect: false, clothes: false }
  }
  if (inRect(95, 181, 145, 300)) return { c: f.pants, person: true, protect: false, clothes: true }
  return { c: bg, person: false, protect: false, clothes: false }
}

/** Рисует сцену; map переводит пиксель картинки в координаты сцены (для генерации — её сдвиг и масштаб) */
function render(f: Figure, w: number, h: number, mapXY: (x: number, y: number) => [number, number], cast = 0) {
  const img: Img = { width: w, height: h, data: new Uint8ClampedArray(w * h * 3) }
  const person = mask(w, h)
  const protect = mask(w, h)
  const clothes = mask(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [sx, sy] = mapXY(x + 0.5, y + 0.5)
      const p = at(f, sx, sy)
      const i = y * w + x
      for (let c = 0; c < 3; c++) img.data[i * 3 + c] = p.c[c] + cast
      person.data[i] = p.person ? 1 : 0
      protect.data[i] = p.protect ? 1 : 0
      clothes.data[i] = p.clothes ? 1 : 0
    }
  }
  return { img, person, protect, clothes }
}

const ORIGINAL: Figure = { face: [210, 170, 140], shirt: OLD_SHIRT, pants: OLD_PANTS }
const original = render(ORIGINAL, W, H, (x, y) => [x, y])

/** Генерация: своё разрешение (×1.25), фигура чуть больше и сдвинута. Истинная связь: x_orig = S·x_gen + DX */
const S = 0.8 * 1.02
const DX = 6
const DY = -4
function generated(f: Figure, cast = 12) {
  return render(f, Math.round(W * 1.25), Math.round(H * 1.25), (x, y) => [S * x + DX, S * y + DY], cast)
}

const px = (img: Img, x: number, y: number): RGB => {
  const i = (y * img.width + x) * 3
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}
const maxDiff = (a: RGB, b: RGB) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))

describe('alignment', () => {
  it('recovers the scale and shift of the generated image', () => {
    const g = generated({ face: [230, 150, 120], shirt: NEW_JACKET, pants: OLD_PANTS })
    const a = align(original.person, g.person)
    expect(a.scale).toBeGreaterThan(S * 0.99)
    expect(a.scale).toBeLessThan(S * 1.01)
    expect(Math.abs(a.dx - DX)).toBeLessThan(2)
    expect(Math.abs(a.dy - DY)).toBeLessThan(2)
    expect(a.iou).toBeGreaterThan(0.97)
  })
})

describe('compose a try-on', () => {
  const gen = generated({ face: [230, 150, 120], shirt: NEW_JACKET, pants: NEW_PANTS })
  const out = composeTryOn({ original: original.img, generated: gen.img, personOrig: original.person, protectedOrig: original.protect, clothesOrig: original.clothes, personGen: gen.person, clothesGen: gen.clothes })

  it('is accepted and keeps every protected pixel from the original', () => {
    expect(out.report.accepted).toBe(true)
    expect(out.report.protectedChanged).toBe(0)
    // лицо на генерации другое — в результате лицо из оригинала
    expect(px(out.image, 120, 60)).toEqual(px(original.img, 120, 60))
    expect(px(out.image, 77, 182)).toEqual(px(original.img, 77, 182))
  })

  it('takes the new clothes from the generation and removes the colour cast', () => {
    expect(maxDiff(px(out.image, 120, 130), NEW_JACKET)).toBeLessThanOrEqual(4)
    expect(maxDiff(px(out.image, 120, 250), NEW_PANTS)).toBeLessThanOrEqual(4)
    expect(out.report.color?.offset.every((o) => o < -8 && o > -16)).toBe(true)
  })

  it('leaves the background and the bare arms untouched', () => {
    expect(px(out.image, 20, 20)).toEqual(px(original.img, 20, 20))
    expect(px(out.image, 220, 300)).toEqual(px(original.img, 220, 300))
    expect(px(out.image, 76, 130)).toEqual(px(original.img, 76, 130))
  })

  it('blends softly at the edge of the clothing zone', () => {
    const edge = [...Array(20).keys()].map((i) => out.blend.data[130 * W + 80 + i])
    expect(edge.some((v) => v > 0.05 && v < 0.95)).toBe(true)
    expect(out.report.changed).toBeGreaterThan(0.1)
    expect(out.report.changed).toBeLessThan(0.3)
  })

  it('grows the zone when the new piece covers more (a jacket over the arms), hands stay real', () => {
    const g = generated({ face: [230, 150, 120], shirt: NEW_JACKET, pants: OLD_PANTS, sleeves: true })
    const r = composeTryOn({ original: original.img, generated: g.img, personOrig: original.person, protectedOrig: original.protect, clothesOrig: original.clothes, personGen: g.person, clothesGen: g.clothes })
    expect(r.report.accepted).toBe(true)
    expect(maxDiff(px(r.image, 76, 130), NEW_JACKET)).toBeLessThanOrEqual(4)
    expect(px(r.image, 77, 182)).toEqual(px(original.img, 77, 182))
    expect(r.report.protectedChanged).toBe(0)
  })

  it('rejects a generation where the pose changed', () => {
    const g = generated({ face: [230, 150, 120], shirt: NEW_JACKET, pants: OLD_PANTS, pose: 'raised' })
    const r = composeTryOn({ original: original.img, generated: g.img, personOrig: original.person, protectedOrig: original.protect, clothesOrig: original.clothes, personGen: g.person, clothesGen: g.clothes })
    expect(r.report.accepted).toBe(false)
    expect(r.report.reason).toMatch(/Figure moved/)
    expect(r.report.bodyIou ?? r.report.iou).toBeLessThan(MIN_IOU)
    // при отказе — честно возвращаем оригинал
    expect(r.image.data).toEqual(original.img.data)
  })
})

describe('mask tools', () => {
  const square = (w: number, x0: number, x1: number): Mask => {
    const m = mask(w, w)
    for (let y = x0; y <= x1; y++) for (let x = x0; x <= x1; x++) m.data[y * w + x] = 1
    return m
  }
  it('dilate, erode and blur keep the shape where they should', () => {
    const m = square(40, 10, 29)
    expect(iou(erode(dilate(m, 3), 3), m)).toBe(1)
    const b = blur(m, 3)
    expect(b.data[20 * 40 + 20]).toBeCloseTo(1, 5)
    expect(b.data[20 * 40 + 10]).toBeGreaterThan(0.2)
    expect(b.data[20 * 40 + 10]).toBeLessThan(0.8)
    expect(b.data[0]).toBe(0)
  })
  it('warp moves a mask by scale and shift', () => {
    const m = square(40, 10, 19)
    const w = warpMask(m, 2, 0, 0, 40, 40)
    expect(w.data[30 * 40 + 30]).toBeGreaterThan(0.5)
    expect(w.data[15 * 40 + 15]).toBe(0)
  })
})
