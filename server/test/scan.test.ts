import { describe, expect, it } from 'vitest'
import { bodyCue, bodyCueText, brightness, checkPose, FRAME, glare, itemCue, motion, poseShift, sharpness, type PosePoint } from '@twin/shared'

/** Человек лицом к камере: голова сверху, ступни внизу, руки чуть в стороны (доли кадра, сырой кадр без зеркала) */
function standing(over: Partial<Record<number, Partial<PosePoint>>> = {}): PosePoint[] {
  const pts: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }))
  const set = (i: number, x: number, y: number) => (pts[i] = { x, y, visibility: 0.95 })
  set(0, 0.5, 0.16) // нос
  set(2, 0.52, 0.145)
  set(5, 0.48, 0.145)
  set(7, 0.54, 0.15)
  set(8, 0.46, 0.15)
  set(11, 0.6, 0.26) // левое плечо человека — справа в кадре
  set(12, 0.4, 0.26)
  set(15, 0.7, 0.52) // кисти в стороны от бёдер
  set(16, 0.3, 0.52)
  set(23, 0.56, 0.52)
  set(24, 0.44, 0.52)
  set(27, 0.56, 0.86)
  set(28, 0.44, 0.86)
  set(29, 0.56, 0.89)
  set(30, 0.44, 0.89)
  set(31, 0.57, 0.9)
  set(32, 0.43, 0.9)
  for (const [i, p] of Object.entries(over)) pts[Number(i)] = { ...pts[Number(i)], ...p }
  return pts
}

describe('frame quality', () => {
  it('brightness, motion and glare', () => {
    expect(brightness([0, 100, 200])).toBe(100)
    expect(motion([10, 10], [20, 30])).toBe(15)
    const hot = new Uint8Array(100).fill(255)
    expect(glare(hot, 10, 10)).toBe(1)
    expect(glare(new Uint8Array(100).fill(120), 10, 10)).toBe(0)
  })

  it('sharp edges score higher than a smooth gradient', () => {
    const w = 40
    const edges = new Uint8Array(w * w).map((_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0)
    const smooth = new Uint8Array(w * w).map((_, i) => (i % w) * 6)
    expect(sharpness(edges, w, w)).toBeGreaterThan(sharpness(smooth, w, w) + 1000)
  })
})

describe('pose check', () => {
  it('a good front pose passes', () => {
    const p = checkPose(standing())
    expect(p).toMatchObject({ person: true, head: true, feet: true, offset: 'center', arms: true, view: 'front' })
    expect(p.fill).toBeGreaterThan(0.6)
    expect(bodyCue(p, 120, 'front')).toBe('ok')
  })

  it('no shoulders or hips means nobody is there', () => {
    expect(checkPose(null).person).toBe(false)
    expect(checkPose(standing({ 11: { visibility: 0.1 } })).person).toBe(false)
    expect(bodyCue(checkPose([]), 120, 'front')).toBe('enter')
  })

  it('feet out of frame asks to step back', () => {
    const p = checkPose(standing({ 29: { y: 1.02 }, 30: { y: 1.02 } }))
    expect(p.feet).toBe(false)
    expect(bodyCue(p, 120, 'front')).toBe('back')
  })

  it('too small in the frame asks to come closer', () => {
    // всё сжато к центру: человек далеко
    const far = standing().map((pt) => ({ ...pt, y: 0.45 + (pt.y - 0.5) * 0.5 }))
    expect(bodyCue(checkPose(far), 120, 'front')).toBe('closer')
  })

  it('off to one side: move back to the middle', () => {
    const shifted = standing().map((pt) => ({ ...pt, x: pt.x - 0.2 }))
    expect(checkPose(shifted).offset).toBe('left')
    expect(bodyCue(checkPose(shifted), 120, 'front')).toBe('left')
  })

  it('arms pressed to the body', () => {
    const p = checkPose(standing({ 15: { x: 0.565 }, 16: { x: 0.435 } }))
    expect(p.arms).toBe(false)
    expect(bodyCue(p, 120, 'front')).toBe('arms')
  })

  it('dark room comes first', () => {
    expect(bodyCue(checkPose(standing()), FRAME.dark - 1, 'front')).toBe('light')
  })

  it('views: side, three-quarter, back', () => {
    const side = checkPose(standing({ 11: { x: 0.52 }, 12: { x: 0.48 } }))
    expect(side.view).toBe('side')
    const quarter = checkPose(standing({ 11: { x: 0.57 }, 12: { x: 0.45 } }))
    expect(quarter.view).toBe('three_quarter')
    const back = checkPose(standing({ 0: { visibility: 0.1 }, 2: { visibility: 0.1 }, 5: { visibility: 0.1 }, 11: { x: 0.4 }, 12: { x: 0.6 } }))
    expect(back.view).toBe('back')
    expect(bodyCue(back, 120, 'back')).toBe('ok')
    // со спины модель иногда «видит» лицо — решает порядок плеч
    expect(checkPose(standing({ 11: { x: 0.4 }, 12: { x: 0.6 } })).view).toBe('back')
    expect(bodyCue(checkPose(standing()), 120, 'side')).toBe('turn')
    expect(bodyCueText('turn', 'side').title).toMatch(/side on/)
  })

  it('pose shift measures movement of the torso', () => {
    const a = standing()
    expect(poseShift(a, a)).toBe(0)
    expect(poseShift(a, a.map((pt) => ({ ...pt, x: pt.x + 0.05 })))).toBeCloseTo(0.05)
    expect(poseShift(a, null)).toBe(1)
  })
})

describe('item cue', () => {
  const good = { light: 120, sharp: 300, move: 2, glare: 0 }
  it('passes a sharp, steady, lit frame', () => {
    expect(itemCue(good, 'front')).toBe('ok')
  })
  it('in order: light, glare on a tag, movement, blur', () => {
    expect(itemCue({ ...good, light: 30 }, 'front')).toBe('light')
    expect(itemCue({ ...good, glare: 0.1 }, 'tag')).toBe('glare')
    expect(itemCue({ ...good, glare: 0.1 }, 'front')).toBe('ok')
    expect(itemCue({ ...good, move: 20 }, 'back')).toBe('still')
    expect(itemCue({ ...good, sharp: 80 }, 'front')).toBe('ok')
    expect(itemCue({ ...good, sharp: 80 }, 'tag')).toBe('blur')
  })
})
