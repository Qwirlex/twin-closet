// Видео и фото через ffmpeg: приводим к виду, который принимают модели Meta, и режем ключевые кадры
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { MediaInfo } from '@twin/shared'

const run = promisify(execFile)

/** Самая длинная сторона кадров для моделей: больше не нужно, а платим за пиксели и время */
export const MAX_SIDE = 1280

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
export async function normalizeVideo(input: string, output: string): Promise<MediaInfo> {
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', input,
    '-vf', `scale='if(gt(iw,ih),min(${MAX_SIDE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_SIDE},ih))'`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
    output
  ])
  return probe(output)
}

/** Фото → JPEG не больше MAX_SIDE (WebP, PNG и повёрнутые снимки приводятся к одному виду) */
export async function normalizeImage(input: string, output: string): Promise<MediaInfo> {
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vf', `scale='min(${MAX_SIDE},iw)':-2`, '-frames:v', '1', '-q:v', '3', output])
  return probe(output)
}

/** count кадров равномерно по видео (без самых краёв, где обычно руки и тряска) */
export async function keyframes(video: string, duration: number, count: number, outPattern: (i: number) => string): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const t = duration * ((i + 0.5) / count)
    const file = outPattern(i)
    await run('ffmpeg', ['-y', '-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '3', file])
    out.push(file)
  }
  return out
}
