import { describe, expect, it } from 'vitest'
import { linkHost, productLink, toLinkTemplate } from './productLink'

const examples = [
  { key: '2200001-123', style: '2200001' },
  { key: '1001-052', style: '1001' },
]

describe('product links', () => {
  it('turns a pasted search or product link into a template', () => {
    expect(toLinkTemplate('https://shop.example/en/search?q=2200001-123', examples)).toBe('https://shop.example/en/search?q={key}')
    expect(toLinkTemplate('https://shop.example/p/linen-shirt-2200001-123?x=1', examples)).toBe('https://shop.example/p/linen-shirt-{key}?x=1')
    expect(toLinkTemplate('https://shop.example/list?search=2200001', examples)).toBe('https://shop.example/list?search={style}')
    expect(toLinkTemplate('https://shop.example/q={key}', examples)).toBe('https://shop.example/q={key}')
  })

  it('recognises ref nos of products outside the line list by their shape', () => {
    const ll = [{ key: '1101311-052', style: '1101311' }]
    expect(toLinkTemplate('https://shop.example/en/search?q=2200001-123', ll)).toBe('https://shop.example/en/search?q={key}')
    expect(toLinkTemplate('https://shop.example/en/mink-trousers-p-2200001-123', ll)).toBe('https://shop.example/en/mink-trousers-p-{key}')
    expect(toLinkTemplate('https://shop.example/en/item/92200001-1231', ll)).toBeNull()
  })

  it('rejects links without a known product, and non-web text', () => {
    expect(toLinkTemplate('https://shop.example/en', examples)).toBeNull()
    expect(toLinkTemplate('2200001-123', examples)).toBeNull()
  })

  it('fills templates per product', () => {
    expect(productLink('https://shop.example/search?q={key}', { key: '1001-052' })).toBe('https://shop.example/search?q=1001-052')
    expect(productLink('https://shop.example/s/{style}/{code}', { key: '1001-052', style: '1001', code: '052' })).toBe('https://shop.example/s/1001/052')
    expect(productLink('https://shop.example/s/{code}', { key: 'x' })).toBeNull()
    expect(productLink(null, { key: 'x' })).toBeNull()
    expect(linkHost('https://www.shop.example/search?q={key}')).toBe('shop.example')
  })
})
