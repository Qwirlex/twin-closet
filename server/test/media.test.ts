import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_FPS, normalizeVideo, oneAtATime, probe, threads } from '../src/media'

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
