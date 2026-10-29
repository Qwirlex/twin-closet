import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_FPS, normalizeVideo, oneAtATime, probe, smartKeyframes, threads } from '../src/media'

const dir = mkdtempSync(join(tmpdir(), 'twin-media-'))

describe('video for the models', () => {
  it('drops a 30 fps phone video to 15 fps and leaves a slower one as it is', async () => {
    for (const [rate, want] of [[30, MAX_FPS], [10, 10]] as const) {
      const src = join(dir, `in-${rate}.mp4`)
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=640x360:rate=${rate}:duration=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src])
      const out = await normalizeVideo(src, join(dir, `out-${rate}.mp4`), await probe(src))
      expect(out.frames! / out.duration!).toBeCloseTo(want, 0)
    }
  }, 30_000)

  it('runs ffmpeg on two threads unless told otherwise', () => {
    expect(threads({})).toBe('2')
    expect(threads({ FFMPEG_THREADS: '1' })).toBe('1')
    expect(threads({ FFMPEG_THREADS: 'lots' })).toBe('2')
  })

  it('runs heavy work one at a time, even after a failure', async () => {
    const order: string[] = []
    const job = (name: string, ms: number, fail = false) =>
      oneAtATime(async () => {
        order.push(`${name}+`)
        await new Promise((r) => setTimeout(r, ms))
        order.push(`${name}-`)
        if (fail) throw new Error(name)
        return name
      })
    const results = await Promise.allSettled([job('a', 30, true), job('b', 5), job('c', 1)])
    expect(order).toEqual(['a+', 'a-', 'b+', 'b-', 'c+', 'c-'])
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled', 'fulfilled'])
  })
})

describe('the best frames of a video (docs/spec-smart-frames.md)', () => {
  const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args])
  const frames = async (src: string, count: number) => smartKeyframes(src, await probe(src), count, (i) => join(dir, `${basename(src)}-k${i}.jpg`))

  it('a still picture filmed for 3 seconds gives one frame, not eight copies', async () => {
    const still = join(dir, 'still.png')
    const src = join(dir, 'still.mp4')
    ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=320x240', '-frames:v', '1', still)
    ffmpeg('-loop', '1', '-i', still, '-t', '3', '-r', '15', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src)
    const out = await frames(src, 8)
    expect(out.paths).toHaveLength(1)
    expect(out.times).toHaveLength(1)
  }, 30_000)

  it('a blurred first half gives no frames while the second half is sharp', async () => {
    const src = join(dir, 'half-blur.mp4')
    ffmpeg('-f', 'lavfi', '-i', "nullsrc=size=320x240:rate=15:duration=4,geq=random(1)*255:128:128,boxblur=luma_radius=8:enable='lt(t,2)'", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src)
    const out = await frames(src, 4)
    expect(out.paths.length).toBeGreaterThan(0)
    for (const t of out.times) expect(t).toBeGreaterThanOrEqual(1.9)
    // сначала резкие кадры, потом по времени
    expect([...out.times].sort((a, b) => a - b)).toEqual(out.times)
  }, 30_000)
})
