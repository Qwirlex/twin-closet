import { describe, expect, it } from 'vitest'
import { cleanStyle, clashesWith, DEMO_STYLE, profileFromVotes, STYLE_FAMILIES, STYLE_IDS, styleLine, styleMatch, stylePrompt, STYLES, stylesIn } from '@twin/shared'

describe('style guide', () => {
  it('has many styles, each with pieces, fabrics and colours', () => {
    expect(STYLE_IDS.length).toBeGreaterThanOrEqual(50)
    for (const id of STYLE_IDS) {
      const g = STYLES[id]
      expect(g.id).toBe(id)
      expect(g.pieces.length).toBeGreaterThan(2)
      expect(g.fabrics.length).toBeGreaterThan(1)
      expect(g.colors.length).toBeGreaterThan(2)
      expect(g.silhouette.length).toBeGreaterThan(5)
    }
  })

  it('every family has at least three styles to pick from', () => {
    for (const f of STYLE_FAMILIES) expect(stylesIn(f).length).toBeGreaterThanOrEqual(3)
  })

  it('the quiz shows each person only styles they could wear', () => {
    const men = stylesIn('soft', 'men').map((s) => s.id)
    const women = stylesIn('soft', 'women').map((s) => s.id)
    expect(men).toContain('soft_boy')
    expect(men).not.toContain('balletcore')
    expect(women).toContain('balletcore')
    expect(women).not.toContain('soft_boy')
  })

  it('clashes go both ways, by family', () => {
    expect(clashesWith('old_money')).toContain('streetwear')
    expect(clashesWith('old_money')).toContain('opium')
    expect(clashesWith('streetwear')).toContain('old_money')
    expect(clashesWith('scandi_minimal')).not.toContain('city_boy')
  })
})

describe('profileFromVotes', () => {
  it('love counts double, top three, weights sum to 100', () => {
    const p = profileFromVotes({ old_money: 'love', poetcore: 'like', city_boy: 'like', streetwear: 'skip' })!
    expect(p.styles.map((s) => s.id)).toEqual(['old_money', 'poetcore', 'city_boy'])
    expect(p.styles.map((s) => s.weight)).toEqual([50, 25, 25])
    expect(profileFromVotes({ scandi_minimal: 'like', boho: 'like', y2k: 'like', techwear: 'like' })!.styles).toHaveLength(3)
  })

  it('rounding remainder goes to the main style', () => {
    const p = profileFromVotes({ scandi_minimal: 'like', opium: 'like', y2k: 'like' })!
    expect(p.styles.map((s) => s.weight)).toEqual([34, 33, 33])
  })

  it('avoids only clashing styles the person skipped', () => {
    const p = profileFromVotes({ old_money: 'love', streetwear: 'skip', opium: 'skip', gorpcore: 'skip' })!
    expect(p.avoid).toEqual(['streetwear', 'opium'])
    // skater тоже против old money, но его не показывали — не избегаем вслепую
    expect(p.avoid).not.toContain('skater')
  })

  it('a liked style is never avoided', () => {
    expect(profileFromVotes({ old_money: 'love', streetwear: 'like' })!.avoid).toEqual([])
  })

  it('colours mix the styles, main first, at most four', () => {
    expect(profileFromVotes({ old_money: 'love', scandi_minimal: 'like' })!.colors).toEqual(['cream', 'black', 'camel', 'charcoal'])
  })

  it('nothing liked means no profile', () => {
    expect(profileFromVotes({ scandi_minimal: 'skip', y2k: 'skip' })).toBeNull()
    expect(profileFromVotes({})).toBeNull()
  })
})

describe('cleanStyle', () => {
  it('drops unknown styles and fixes weights', () => {
    const p = cleanStyle({ styles: [{ id: 'scandi_minimal', weight: 3 }, { id: 'nope', weight: 5 }, { id: 'boho', weight: 1 }], avoid: ['y2k', 'scandi_minimal', 'nope'], colors: ['black'] })!
    expect(p.styles).toEqual([
      { id: 'scandi_minimal', weight: 75 },
      { id: 'boho', weight: 25 }
    ])
    expect(p.avoid).toEqual(['y2k'])
    expect(p.colors).toEqual(['black'])
  })

  it('returns null for junk', () => {
    expect(cleanStyle(null)).toBeNull()
    expect(cleanStyle('minimal')).toBeNull()
    expect(cleanStyle({ styles: [] })).toBeNull()
    expect(cleanStyle({ styles: [{ id: 'toString', weight: 1 }] })).toBeNull()
  })
})

describe('styleMatch and prompt', () => {
  const profile = profileFromVotes({ old_money: 'love', poetcore: 'like', city_boy: 'like', streetwear: 'skip' })!

  it('scores a look by its styles, avoided style is zero', () => {
    expect(styleMatch(['old_money', 'poetcore'], profile)).toBe(75)
    expect(styleMatch(['boho'], profile)).toBe(0)
    expect(styleMatch(['city_boy', 'streetwear'], profile)).toBe(0)
    expect(styleMatch(['city_boy'], null)).toBe(0)
  })

  it('line and prompt name the styles', () => {
    expect(styleLine(profile)).toBe('Old money · Poetcore · City boy')
    const prompt = stylePrompt(profile)
    expect(prompt).toContain('Old money (50%)')
    expect(prompt).toContain('Leave out streetwear unless they ask.')
    expect(prompt).toContain('No plain basics')
  })

  it('without a profile only the live-detail rule is left', () => {
    expect(stylePrompt(null)).toMatch(/^No plain basics/)
  })
})

describe('demo account style', () => {
  it('is a real quiz result that the demo looks belong to', () => {
    expect(cleanStyle(DEMO_STYLE)).toEqual(DEMO_STYLE)
    expect(DEMO_STYLE.styles.map((s) => s.id)).toEqual(['nineties_minimal', 'scandi_minimal', 'military'])
    const weights = DEMO_STYLE.styles.map((s) => s.weight)
    expect([...weights].sort((a, b) => b - a)).toEqual(weights)
    // стили четырёх демо-образов (app/src/data/demo.ts): каждый образ — «в стиле»
    const looks = [['military', 'skater'], ['scandi_minimal', 'nineties_minimal'], ['military', 'nineties_minimal'], ['scandi_minimal', 'normcore']] as const
    for (const tags of looks) expect(styleMatch([...tags], DEMO_STYLE)).toBeGreaterThan(0)
  })
})
