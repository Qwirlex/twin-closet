import { describe, expect, it } from 'vitest'
import { isLiveStore, isStoreHost, isStorePage, LIVE_STORE_DOMAINS, LIVE_STORE_IDS, LIVE_STORES, storeOfUrl } from '@twin/shared'
import { findProduct, storeLinks } from '../src/models/spark'
import type { ResponsesOutput } from '../src/meta'

describe('live store registry', () => {
  it('has the online and cheap stores next to Inditex, each with a name and domains', () => {
    expect(LIVE_STORE_IDS).toEqual(['zara', 'bershka', 'pull-and-bear', 'asos', 'zalando', 'h-and-m', 'shein', 'aliexpress', 'temu'])
    for (const id of LIVE_STORE_IDS) {
      const s = LIVE_STORES[id]
      expect(s.id).toBe(id)
      expect(s.name.length).toBeGreaterThan(1)
      expect(s.domains.length).toBeGreaterThan(0)
      expect(LIVE_STORE_DOMAINS[id]).toBe(s.domains[0])
    }
    expect(LIVE_STORES.temu.type).toBe('marketplace')
    expect(LIVE_STORES.shein.sizing).toMatch(/run small/)
    expect(LIVE_STORES.zara.sizing).toBeNull()
    expect(isLiveStore('asos')).toBe(true)
    expect(isLiveStore('mango')).toBe(false)
  })

  it('accepts the store’s own domains and subdomains only', () => {
    expect(isStoreHost('zalando', 'www.zalando.ie')).toBe(true)
    expect(isStoreHost('zalando', 'zalando.de')).toBe(true)
    expect(isStoreHost('zalando', 'zalando.evil.com')).toBe(false)
    expect(isStoreHost('asos', 'asos.com.evil.io')).toBe(false)
    expect(isStoreHost('h-and-m', 'www2.hm.com')).toBe(true)
    expect(isStoreHost('shein', 'ie.shein.com')).toBe(true)
    expect(isStoreHost('shein', 'shein.co.uk')).toBe(true)
    expect(isStoreHost('mango', 'mango.com')).toBe(false)
    expect(isStorePage('https://www.temu.com/ie/x-g-601099512345678.html', 'temu')).toBe(true)
    expect(isStorePage('not a url', 'temu')).toBe(false)
  })

  it('reads the store and the product number from a pasted link', () => {
    expect(storeOfUrl('https://www.asos.com/asos-design/asos-design-relaxed-jeans/prd/205123456#colourWayId=1')).toEqual({ storeId: 'asos', productId: '205123456' })
    expect(storeOfUrl('https://www.zalando.ie/levis-501-straight-le221n0ab-k11.html')).toEqual({ storeId: 'zalando', productId: 'LE221N0AB-K11' })
    expect(storeOfUrl('https://www2.hm.com/en_gb/productpage.1234567001.html')).toEqual({ storeId: 'h-and-m', productId: '1234567001' })
    expect(storeOfUrl('https://ie.shein.com/Men-Drop-Shoulder-Sweatshirt-p-12345678.html?src=x')).toEqual({ storeId: 'shein', productId: '12345678' })
    expect(storeOfUrl('https://www.aliexpress.com/item/1005006123456789.html')).toEqual({ storeId: 'aliexpress', productId: '1005006123456789' })
    expect(storeOfUrl('https://www.temu.com/ie/mens-jacket-g-601099512345678.html')).toEqual({ storeId: 'temu', productId: '601099512345678' })
    expect(storeOfUrl('https://www.zara.com/ie/en/wide-leg-jeans-p04048213.html?v1=1')).toEqual({ storeId: 'zara', productId: '04048213' })
    expect(storeOfUrl('https://www.bershka.com/ie/jeans-c0p123.html')).toEqual({ storeId: 'bershka', productId: null })
    expect(storeOfUrl('https://example.com/item/123.html')).toBeNull()
    expect(storeOfUrl('not a url')).toBeNull()
  })
})

describe('store search on Muse Spark', () => {
  const cited = (urls: string[]) => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{}', annotations: urls.map((url) => ({ type: 'url_citation', url })) }] }] }) as unknown as ResponsesOutput

  it('keeps citations from every country domain of the store', () => {
    const links = storeLinks(cited(['https://www.zalando.ie/a-le221n0ab-k11.html', 'https://zalando.evil.com/x', 'https://www.zalando.de/b.html']), 'zalando')
    expect(links).toEqual(['https://www.zalando.ie/a-le221n0ab-k11.html', 'https://www.zalando.de/b.html'])
  })

  it('tells the model how marketplaces and multi-brand stores work', () => {
    const temu = findProduct(LIVE_STORES.temu).system
    expect(temu).toMatch(/sellers/)
    expect(temu).toContain('temu.com')
    const zalando = findProduct(LIVE_STORES.zalando).system
    expect(zalando).toContain('zalando.ie')
    expect(zalando).toMatch(/brand/)
  })
})
