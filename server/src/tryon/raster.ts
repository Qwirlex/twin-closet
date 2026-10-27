// Картинки и маски для склейки примерки: простые буферы пикселей и операции над ними
import sharp from 'sharp'

/** RGB, 3 байта на пиксель, построчно */
export interface Img {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Маска 0..1 (дробная — для мягких краёв), построчно */
export interface Mask {
  width: number
  height: number
  data: Float32Array
}

export function mask(width: number, height: number, fill = 0): Mask {
  return { width, height, data: new Float32Array(width * height).fill(fill) }
}

export async function readImg(input: string | Buffer): Promise<Img> {
  const { data, info } = await sharp(input).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}

export async function writeImg(img: Img, path: string): Promise<void> {
  const s = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), { raw: { width: img.width, height: img.height, channels: 3 } })
  await (path.endsWith('.jpg') ? s.jpeg({ quality: 92 }) : s.png()).toFile(path)
}

export async function writeMask(m: Mask, path: string): Promise<void> {
  const bytes = Buffer.alloc(m.width * m.height)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.max(0, Math.min(1, m.data[i])) * 255)
  await sharp(bytes, { raw: { width: m.width, height: m.height, channels: 1 } }).png().toFile(path)
}

/** Маска из растра 0/1 (как отдаёт SAM после декодирования), растянутая до размера кадра */
export function maskFromBits(bits: Uint8Array, width: number, height: number, toW = width, toH = height): Mask {
  const m = mask(width, height)
  for (let i = 0; i < bits.length; i++) m.data[i] = bits[i] ? 1 : 0
  return toW === width && toH === height ? m : resize(m, toW, toH)
}

/** Билинейное растяжение маски */
export function resize(m: Mask, w: number, h: number): Mask {
  const out = mask(w, h)
  const sx = m.width / w
  const sy = m.height / h
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out.data[y * w + x] = sampleMask(m, (x + 0.5) * sx - 0.5, (y + 0.5) * sy - 0.5)
  }
  return out
}

export function sampleMask(m: Mask, x: number, y: number): number {
  if (x < -0.5 || y < -0.5 || x > m.width - 0.5 || y > m.height - 0.5) return 0
  const x0 = Math.max(0, Math.min(m.width - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(m.height - 1, Math.floor(y)))
  const x1 = Math.min(m.width - 1, x0 + 1)
  const y1 = Math.min(m.height - 1, y0 + 1)
  const fx = Math.max(0, Math.min(1, x - x0))
  const fy = Math.max(0, Math.min(1, y - y0))
  const d = m.data
  const a = d[y0 * m.width + x0] * (1 - fx) + d[y0 * m.width + x1] * fx
  const b = d[y1 * m.width + x0] * (1 - fx) + d[y1 * m.width + x1] * fx
  return a * (1 - fy) + b * fy
}

export const map = (m: Mask, f: (v: number, i: number) => number): Mask => {
  const out = mask(m.width, m.height)
  for (let i = 0; i < m.data.length; i++) out.data[i] = f(m.data[i], i)
  return out
}

export const union = (a: Mask, b: Mask): Mask => map(a, (v, i) => Math.max(v, b.data[i]))
export const subtract = (a: Mask, b: Mask): Mask => map(a, (v, i) => Math.min(v, 1 - b.data[i]))
export const intersect = (a: Mask, b: Mask): Mask => map(a, (v, i) => Math.min(v, b.data[i]))
export const binary = (m: Mask, t = 0.5): Mask => map(m, (v) => (v >= t ? 1 : 0))

/** Расширение (max) или сужение (min) квадратом радиуса r — раздельно по осям */
function morph(m: Mask, r: number, pick: (a: number, b: number) => number): Mask {
  if (r <= 0) return map(m, (v) => v)
  const { width: w, height: h } = m
  const tmp = new Float32Array(w * h)
  const out = mask(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = m.data[y * w + x]
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = pick(v, m.data[y * w + k])
      tmp[y * w + x] = v
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = tmp[y * w + x]
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = pick(v, tmp[k * w + x])
      out.data[y * w + x] = v
    }
  }
  return out
}

export const dilate = (m: Mask, r: number): Mask => morph(m, r, Math.max)
export const erode = (m: Mask, r: number): Mask => morph(m, r, Math.min)

/** Размытие: три прохода «коробкой» ≈ гауссово, радиус r */
export function blur(m: Mask, r: number): Mask {
  if (r <= 0) return map(m, (v) => v)
  let cur = m
  for (let pass = 0; pass < 3; pass++) cur = boxPass(boxPass(cur, r, true), r, false)
  return cur
}

function boxPass(m: Mask, r: number, horizontal: boolean): Mask {
  const { width: w, height: h } = m
  const out = mask(w, h)
  const len = horizontal ? w : h
  const lines = horizontal ? h : w
  const at = (line: number, i: number) => (horizontal ? line * w + i : i * w + line)
  for (let line = 0; line < lines; line++) {
    let sum = 0
    for (let i = -r; i <= r; i++) sum += m.data[at(line, Math.max(0, Math.min(len - 1, i)))]
    for (let i = 0; i < len; i++) {
      out.data[at(line, i)] = sum / (2 * r + 1)
      sum += m.data[at(line, Math.min(len - 1, i + r + 1))] - m.data[at(line, Math.max(0, i - r))]
    }
  }
  return out
}

export function area(m: Mask, t = 0.5): number {
  let n = 0
  for (const v of m.data) if (v >= t) n++
  return n
}

export function bbox(m: Mask, t = 0.5): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (m.data[y * m.width + x] >= t) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

export function iou(a: Mask, b: Mask, t = 0.5): number {
  let inter = 0, uni = 0
  for (let i = 0; i < a.data.length; i++) {
    const p = a.data[i] >= t
    const q = b.data[i] >= t
    if (p && q) inter++
    if (p || q) uni++
  }
  return uni ? inter / uni : 0
}

/**
 * Перенос картинки: точка (x, y) результата берётся из исходника в ((x − dx) / s, (y − dy) / s).
 * valid — где исходника хватило (за краем генерации брать нечего).
 */
export function warpImg(src: Img, s: number, dx: number, dy: number, w: number, h: number): { img: Img; valid: Mask } {
  const out: Img = { width: w, height: h, data: new Uint8ClampedArray(w * h * 3) }
  const valid = mask(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5 - dx) / s - 0.5
      const sy = (y + 0.5 - dy) / s - 0.5
      if (sx < -0.5 || sy < -0.5 || sx > src.width - 0.5 || sy > src.height - 0.5) continue
      const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)))
      const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)))
      const x1 = Math.min(src.width - 1, x0 + 1)
      const y1 = Math.min(src.height - 1, y0 + 1)
      const fx = Math.max(0, Math.min(1, sx - x0))
      const fy = Math.max(0, Math.min(1, sy - y0))
      const o = (y * w + x) * 3
      for (let c = 0; c < 3; c++) {
        const p = (yy: number, xx: number) => src.data[(yy * src.width + xx) * 3 + c]
        out.data[o + c] = (p(y0, x0) * (1 - fx) + p(y0, x1) * fx) * (1 - fy) + (p(y1, x0) * (1 - fx) + p(y1, x1) * fx) * fy
      }
      valid.data[y * w + x] = 1
    }
  }
  return { img: out, valid }
}

export function warpMask(src: Mask, s: number, dx: number, dy: number, w: number, h: number): Mask {
  const out = mask(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out.data[y * w + x] = sampleMask(src, (x + 0.5 - dx) / s - 0.5, (y + 0.5 - dy) / s - 0.5)
  }
  return out
}
