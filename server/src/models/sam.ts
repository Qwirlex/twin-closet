// SAM 3.1: подсказки и разбор ответа (docs/meta-api.md, «SAM 3.1»).
// Рамки разбираем сами; растры масок (base85) декодирует официальный @meta-sam/parser — подключим, когда разрешат установку.
import { MODELS } from '../meta'

/** Подсказка-понятие: одна короткая фраза-существительное на запрос («t-shirt», не списки через запятую) */
export function conceptPrompt(noun: string): string {
  const clean = noun.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Empty SAM concept')
  return clean
}

export interface ObjectPrompt {
  /** наш номер объекта: он вернётся в ответе и держится через кадры видео */
  id: number
  box?: { x1: number; y1: number; x2: number; y2: number }
  /** точки: positive — «это объект», negative — «это не объект» */
  points?: { x: number; y: number; negative?: boolean }[]
}

/**
 * Рамки и точки с нашими id, до 16 объектов: `<0f>1<|box;x1=..;y1=..;x2=..;y2=..;w=W;h=H|>,2<|point;x=..;y=..;w=W;h=H|>`.
 * Координаты — пиксели исходника, w/h — размер кадра после поворота (иначе 400).
 */
export function objectPrompt(objects: ObjectPrompt[], width: number, height: number, frame = 0): string {
  if (!objects.length) throw new Error('No objects for SAM')
  if (objects.length > 16) throw new Error('SAM takes at most 16 objects per request — split into groups')
  const size = `w=${width};h=${height}`
  const r = Math.round
  return (
    `<${frame}f>` +
    objects
      .map((o) => {
        const parts: string[] = []
        if (o.box) parts.push(`<|box;x1=${r(o.box.x1)};y1=${r(o.box.y1)};x2=${r(o.box.x2)};y2=${r(o.box.y2)};${size}|>`)
        for (const p of o.points ?? []) parts.push(`${p.negative ? '-' : ''}<|point;x=${r(p.x)};y=${r(p.y)};${size}|>`)
        if (!parts.length) throw new Error(`SAM object ${o.id} has no box or points`)
        return `${o.id}${parts.join('')}`
      })
      .join(',')
  )
}

/** Тело запроса: картинка (data: URL / URL) или видео (file_id из /files) */
export function samRequest(prompt: string, media: { imageUrl: string } | { videoFileId: string }): Record<string, unknown> {
  return {
    model: MODELS.sam,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }, 'imageUrl' in media ? { type: 'input_image', image_url: media.imageUrl } : { type: 'input_video', file_id: media.videoFileId }]
      }
    ],
    // маски по одному биту и уверенность — ответ в разы меньше
    metadata: { mask_encoding: 'one_bit', include_confidence: 'true' }
  }
}

export interface SamRecord {
  frame: number
  id: number
  box: { x1: number; y1: number; x2: number; y2: number; w: number; h: number; c: number | null } | null
  /** закодированная маска как есть — декодирует @meta-sam/parser */
  mask: string | null
}

/**
 * Разбор текста ответа: по строке на кадр, `<Nf>id<|box;…|><|mask;…|>,id…`. Кадры могут идти не по порядку и пропускаться —
 * ключуем по <Nf>. Значения рамки бывают и «x1=10», и просто по порядку — понимаем оба.
 */
export function parseSam(text: string): SamRecord[] {
  const out: SamRecord[] = []
  for (const line of text.split(/\r?\n/)) {
    const fm = line.match(/^\s*<(\d+)f>/)
    if (!fm) continue
    const frame = Number(fm[1])
    const body = line.slice(fm[0].length)
    for (const m of body.matchAll(/(?:^|,)\s*(\d+)((?:<\|[^|]*(?:\|(?!>)[^|]*)*\|>)+)/g)) {
      const id = Number(m[1])
      const segs = [...m[2].matchAll(/<\|([^|]*(?:\|(?!>)[^|]*)*)\|>/g)].map((s) => s[1])
      const boxSeg = segs.find((s) => s.startsWith('box;'))
      const maskSeg = segs.find((s) => s.startsWith('mask;'))
      out.push({ frame, id, box: boxSeg ? parseBox(boxSeg) : null, mask: maskSeg ?? null })
    }
  }
  return out
}

function parseBox(seg: string): SamRecord['box'] {
  const vals = seg.split(';').slice(1)
  const named = Object.fromEntries(vals.filter((v) => v.includes('=')).map((v) => v.split('=') as [string, string]))
  const plain = vals.filter((v) => !v.includes('=')).map(Number)
  const get = (key: string, i: number) => Number(named[key] ?? plain[i])
  const box = { x1: get('x1', 0), y1: get('y1', 1), x2: get('x2', 2), y2: get('y2', 3), w: get('w', 4), h: get('h', 5), c: named.c !== undefined || plain[6] !== undefined ? get('c', 6) : null }
  return [box.x1, box.y1, box.x2, box.y2].every(Number.isFinite) ? box : null
}
