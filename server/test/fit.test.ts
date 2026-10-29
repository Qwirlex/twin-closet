import { describe, expect, it } from 'vitest'
import { cleanBody, cmToIn, fitReport, garmentFitFromTape, inToCm, TAPE_ZONES, zoneFit, type BodyMeasurements, type GarmentFit } from '@twin/shared'
import { tryOnPrompt } from '../src/models/image'

const BODY: BodyMeasurements = { heightCm: 183, weightKg: 74, chestCm: 98, waistCm: 80, hipsCm: 96, inseamCm: 84, shoeEu: 43 }

const WIDE: GarmentFit = {
  cut: 'wide',
  stretch: false,
  size: 'W32',
  source: 'demo',
  sizes: [
    { size: 'W31', zones: { waist: 76.5, hips: 101.5, thigh: 70.5, inseam: 86 } },
    { size: 'W32', zones: { waist: 79, hips: 104, thigh: 72, inseam: 86 } },
    { size: 'W33', zones: { waist: 82, hips: 107, thigh: 73.5, inseam: 86 } }
  ]
}

const FAVORITE: GarmentFit = { cut: 'regular', stretch: false, size: 'W32', source: 'demo', sizes: [{ size: 'W32', zones: { waist: 82, hips: 98, thigh: 60, inseam: 83 } }] }

describe('zoneFit', () => {
  it('tight below the body, snug with stretch', () => {
    expect(zoneFit('waist', -1, 'regular', false)).toMatchObject({ verdict: 'tight', tone: 'problem' })
    expect(zoneFit('waist', -2, 'regular', true)).toMatchObject({ verdict: 'snug', tone: 'note' })
  })

  it('lots of room is fine when the cut is oversize', () => {
    expect(zoneFit('chest', 20, 'oversize', false)).toMatchObject({ tone: 'good', label: 'Oversized, as cut' })
    expect(zoneFit('chest', 20, 'slim', false).tone).not.toBe('good')
  })

  it('length: above the ankle, break, stack', () => {
    expect(zoneFit('inseam', -4, 'regular', false)).toMatchObject({ tone: 'problem', label: 'Ends above the ankle' })
    expect(zoneFit('inseam', 2, 'regular', false)).toMatchObject({ tone: 'note', label: 'Light break at the shoe' })
    expect(zoneFit('inseam', 6, 'regular', false)).toMatchObject({ tone: 'problem', label: 'Stacks at the ankle' })
    expect(zoneFit('inseam', 6, 'wide', false)).toMatchObject({ tone: 'note' })
  })

  it('a loose waist is a problem, loose hips are not', () => {
    expect(zoneFit('waist', 9, 'regular', false).tone).toBe('problem')
    expect(zoneFit('hips', 14, 'regular', false).tone).toBe('note')
  })
})

describe('fitReport', () => {
  it('wide-leg W32: one catch at the waist, W33 fixes it', () => {
    const r = fitReport('bottom', WIDE, { body: BODY, showSize: true })
    expect(r.title).toBe('Fits, with one catch')
    expect(r.zones.map((z) => [z.zone, z.tone])).toEqual([
      ['waist', 'problem'],
      ['hips', 'good'],
      ['thigh', 'good'],
      ['inseam', 'note']
    ])
    expect(r.summary).toBe('Tight at the waist by 1 cm.')
    expect(r.advice).toBe('W33 fits your waist, and the hips stay relaxed.')
  })

  it('sizes stay hidden unless asked', () => {
    const r = fitReport('bottom', WIDE, { body: BODY, showSize: false })
    expect(r.advice).toBe('One size up fits your waist, and the hips stay relaxed.')
    expect(r.advice).not.toMatch(/W\d/)
  })

  it('no size fits waist and hips at once: advise a cut, not a bigger size', () => {
    const slim: GarmentFit = {
      ...WIDE,
      cut: 'slim',
      sizes: [
        { size: 'W32', zones: { waist: 79, hips: 95 } },
        { size: 'W33', zones: { waist: 82, hips: 94 } }
      ]
    }
    const r = fitReport('bottom', slim, { body: BODY, showSize: true })
    expect(r.title).toBe("Won't fit as is")
    expect(r.advice).toBe('In this cut no size fits your waist and hips at once. A relaxed or curve fit, or a piece with stretch, will.')
  })

  it('zones without a body number are listed as missing', () => {
    const r = fitReport('bottom', WIDE, { body: { ...BODY, hipsCm: null }, showSize: true })
    expect(r.zones.map((z) => z.zone)).toEqual(['waist', 'inseam'])
    expect(r.missing).toEqual(['hips', 'thigh'])
  })

  it('thigh is estimated from the hips', () => {
    const r = fitReport('bottom', WIDE, { body: BODY, showSize: true })
    expect(r.zones.find((z) => z.zone === 'thigh')).toMatchObject({ estimated: true, roomCm: 14 })
  })

  it('compares with the favorite piece', () => {
    const r = fitReport('bottom', WIDE, { body: BODY, showSize: true, favorite: { name: 'black jeans', fit: FAVORITE } })
    expect(r.vsFavorite).toBe('Next to your black jeans: 3 cm tighter in the waist, 6 cm roomier in the hips.')
  })

  it('works with no body at all when a favorite is known', () => {
    const r = fitReport('bottom', WIDE, { body: null, showSize: false, favorite: { name: 'black jeans', fit: FAVORITE } })
    expect(r.zones).toEqual([])
    expect(r.vsFavorite).toMatch(/^Next to your black jeans/)
  })
})

describe('body and units', () => {
  it('drops typos and junk', () => {
    expect(cleanBody({ heightCm: 1830, waistCm: 80, hipsCm: 'x' })).toMatchObject({ heightCm: null, waistCm: 80, hipsCm: null })
    expect(cleanBody(null)).toBeNull()
  })

  it('cm and inches', () => {
    expect(cmToIn(80)).toBe(31.5)
    expect(inToCm(32)).toBe(81)
  })
})

describe('try-on prompt', () => {
  it('passes the fit of each garment to Muse Image', () => {
    const text = tryOnPrompt([{ label: 'wide-leg jeans', image: { type: 'input_image', image_url: 'x' } as never, fit: 'tight at the waist; light break at the shoe' }], 'front')
    expect(text).toContain('garment 1 sits tight at the waist; light break at the shoe')
  })
})

describe('favorite piece measured flat with a tape', () => {
  it('doubles flat widths into circumferences, keeps the inside leg', () => {
    const { fit, errors } = garmentFitFromTape('bottom', { waist: 41, hips: 49, thigh: 30, inseam: 83 }, 'regular', false)
    expect(errors).toEqual([])
    expect(fit).toEqual({ cut: 'regular', stretch: false, size: 'Yours', source: 'tape', sizes: [{ size: 'Yours', zones: { waist: 82, hips: 98, thigh: 60, inseam: 83 } }] })
  })

  it('refuses numbers out of range and empty forms', () => {
    expect(garmentFitFromTape('bottom', { waist: 10, hips: 49 }, 'regular', false)).toEqual({ fit: null, errors: ['waist'] })
    expect(garmentFitFromTape('bottom', {}, 'regular', false)).toEqual({ fit: null, errors: [] })
    // у верха меряем только грудь; лишнее не берём
    const top = garmentFitFromTape('outerwear', { chest: 56, waist: 40 }, 'relaxed', true)
    expect(top.fit!.sizes[0].zones).toEqual({ chest: 112 })
    expect(top.fit!.stretch).toBe(true)
    expect(TAPE_ZONES('shoes')).toEqual([])
    expect(TAPE_ZONES('bottom').map((z) => z.zone)).toEqual(['waist', 'hips', 'thigh', 'inseam'])
  })

  it('new jeans are compared with the measured favorite', () => {
    const { fit } = garmentFitFromTape('bottom', { waist: 41, hips: 49, thigh: 30, inseam: 83 }, 'regular', false)
    const r = fitReport('bottom', WIDE, { body: BODY, showSize: false, favorite: { name: 'black jeans', fit: fit! } })
    expect(r.vsFavorite).toBe('Next to your black jeans: 3 cm tighter in the waist, 6 cm roomier in the hips.')
  })
})
