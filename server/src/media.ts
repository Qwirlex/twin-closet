// Видео и фото через ffmpeg: приводим к виду, который принимают модели Meta, и режем ключевые кадры
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { brightness, pickFrames, sharpness, type FrameScore, type MediaInfo } from '@twin/shared'

const run = promisify(execFile)

let lane: Promise<unknown> = Promise.resolve()

/**
 * Тяжёлая работа (перекодировать видео, склеить примерку) — по одной за раз: 4K-видео с iPhone занимает ~330 MB,
 * две разом не влезут в 512 MB тарифа. Остальные ждут своей очереди на шаге «Preparing»
 */
export function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const next = lane.then(fn, fn)
  lane = next.catch(() => {})
  return next
}

/** Самая длинная сторона кадров для моделей: больше не нужно, а платим за пиксели и время */
export const MAX_SIDE = 1280
/** Кадров в секунду в видео для моделей */
export const MAX_FPS = 15

interface Probe {
  streams: { codec_type: string; width?: number; height?: number; nb_frames?: string; avg_frame_rate?: string }[]
  format: { duration?: string }
}

export async function probe(path: string): Promise<MediaInfo> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path])
  const p = JSON.parse(stdout) as Probe
  const v = p.streams.find((s) => s.codec_type === 'video')
  if (!v?.width || !v.height) throw new Error('В файле нет видео или картинки')
  const duration = p.format.duration ? Number(p.format.duration) : null
  const isVideo = duration !== null && duration > 0.2 && v.nb_frames !== '1'
  const [num, den] = (v.avg_frame_rate ?? '0/1').split('/').map(Number)
  const fps = den ? num / den : 0
  const frames = isVideo ? (v.nb_frames && Number(v.nb_frames) > 0 ? Number(v.nb_frames) : Math.round((duration ?? 0) * fps)) : null
  return { kind: isVideo ? 'video' : 'image', width: v.width, height: v.height, duration: isVideo ? duration : null, frames }
}

/**
 * Любое видео (MOV с телефона, WebM из браузера) → MP4 H.264 с faststart, не больше MAX_SIDE, без звука.
 * ffmpeg сам поворачивает по метаданным, поэтому ширина и высота дальше честные — SAM без этого отвечает 400.
 */
export async function normalizeVideo(input: string, output: string, source?: MediaInfo): Promise<MediaInfo> {
  const t = threads()
  // 15 кадров в секунду: для медленного прохода камерой SAM хватает, кадров вдвое меньше — дешевле и быстрее.
  // Реже 15 не трогаем (без выражений в фильтре — в Docker ffmpeg 5.1)
  const fps = source?.frames && source.duration ? source.frames / source.duration : null
  const scale = `scale='if(gt(iw,ih),min(${MAX_SIDE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_SIDE},ih))'`
  await oneAtATime(() =>
    run('ffmpeg', [
      '-y', '-v', 'error', '-threads', t, '-filter_threads', t, '-i', input,
      '-vf', fps === null || fps > MAX_FPS + 0.5 ? `fps=${MAX_FPS},${scale}` : scale,
      '-c:v', 'libx264', '-preset', 'superfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', '-threads', t,
      output
    ])
  )
  return probe(output)
}

/**
 * Потоки ffmpeg. Сам он берёт по числу ядер машины, а хостинг показывает все ядра сервера, хотя даёт пол-ядра:
 * 4K HEVC с iPhone тогда съедает 800 MB при 512 MB тарифа. Двух потоков хватает, памяти — в разы меньше
 */
export function threads(env: Record<string, string | undefined> = process.env): string {
  const n = Number(env.FFMPEG_THREADS)
  return String(Number.isInteger(n) && n > 0 ? n : 2)
}

/** Фото → JPEG не больше MAX_SIDE (WebP, PNG и повёрнутые снимки приводятся к одному виду) */
export async function normalizeImage(input: string, output: string): Promise<MediaInfo> {
  await oneAtATime(() => run('ffmpeg', ['-y', '-v', 'error', '-threads', threads(), '-i', input, '-vf', `scale='min(${MAX_SIDE},iw)':-2`, '-frames:v', '1', '-q:v', '3', output]))
  return probe(output)
}

/** Один кадр видео на секунде t → JPEG (лучший кадр вещи для вырезки) */
export async function frameAt(video: string, t: number, out: string): Promise<string> {
  await run('ffmpeg', ['-y', '-v', 'error', '-threads', threads(), '-ss', Math.max(0, t).toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '2', out])
  return out
}

/** count кадров равномерно по видео (без самых краёв, где обычно руки и тряска) */
export async function keyframes(video: string, duration: number, count: number, outPattern: (i: number) => string): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const t = duration * ((i + 0.5) / count)
    const file = outPattern(i)
    await run('ffmpeg', ['-y', '-v', 'error', '-threads', threads(), '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '3', file])
    out.push(file)
  }
  return out
}

/** Серые превью видео: 4 кадра в секунду, 240 px по ширине (так же меряет резкость телефон) — прямо из ffmpeg, без файлов */
export async function grayThumbs(video: string, info: MediaInfo, fps = 4, width = 240): Promise<{ t: number; gray: Uint8Array; w: number; h: number }[]> {
  const w = width
  const h = Math.max(2, Math.round((w * info.height) / Math.max(1, info.width) / 2) * 2)
  const data = await oneAtATime(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        const p = spawn('ffmpeg', ['-v', 'error', '-threads', threads(), '-i', video, '-vf', `fps=${fps},scale=${w}:${h},format=gray`, '-f', 'rawvideo', 'pipe:1'])
        const chunks: Buffer[] = []
        p.stdout.on('data', (c: Buffer) => chunks.push(c))
        p.on('error', reject)
        p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exited with ${code}`))))
      })
  )
  const size = w * h
  const out: { t: number; gray: Uint8Array; w: number; h: number }[] = []
  for (let i = 0; (i + 1) * size <= data.length; i++) out.push({ t: i / fps, gray: new Uint8Array(data.buffer, data.byteOffset + i * size, size), w, h })
  return out
}

/**
 * До count лучших кадров видео (docs/spec-smart-frames.md): резкие, не повторяются, по всему проходу.
 * Возвращает файлы в полном размере, их секунды и резкость
 */
export async function smartKeyframes(video: string, info: MediaInfo, count: number, outPattern: (i: number) => string): Promise<{ paths: string[]; times: number[]; sharp: number[] }> {
  const thumbs = await grayThumbs(video, info)
  const scores: FrameScore[] = thumbs.map((f) => ({ t: f.t, sharp: sharpness(f.gray, f.w, f.h), light: brightness(f.gray), thumb: f.gray }))
  const picks = pickFrames(scores, count)
  if (!picks.length) {
    // ffmpeg не отдал превью (очень короткое видео) — по старинке, равномерно
    const paths = await keyframes(video, info.duration ?? 0, count, outPattern)
    return { paths, times: paths.map((_, i) => (info.duration ?? 0) * ((i + 0.5) / count)), sharp: paths.map(() => 0) }
  }
  const paths: string[] = []
  for (const [k, i] of picks.entries()) paths.push(await frameAt(video, scores[i].t, outPattern(k)))
  return { paths, times: picks.map((i) => scores[i].t), sharp: picks.map((i) => scores[i].sharp) }
}
