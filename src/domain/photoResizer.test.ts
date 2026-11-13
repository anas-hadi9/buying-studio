import { describe, expect, it } from 'vitest'
import { DEFAULT_PHOTO_RESIZER, isPhotoResizer, photoWidth, resizedPhotoUrl } from './photoResizer'

describe('photo resizer', () => {
  it('builds small-copy addresses with the original URL-encoded', () => {
    expect(resizedPhotoUrl(DEFAULT_PHOTO_RESIZER, 'https://img.example/a b/1001-052.jpg', 640)).toBe(
      'https://wsrv.nl/?url=https%3A%2F%2Fimg.example%2Fa%20b%2F1001-052.jpg&w=640&we&output=webp&q=75',
    )
  })

  it('picks one of a few shared widths', () => {
    expect(photoWidth(280, 1, false)).toBe(320)
    expect(photoWidth(280, 2, false)).toBe(640)
    expect(photoWidth(280, 1.25, false)).toBe(640)
    expect(photoWidth(600, 3, false)).toBe(960)
    expect(photoWidth(900, 1, true)).toBe(320)
  })

  it('accepts only web addresses with {url}', () => {
    expect(isPhotoResizer(DEFAULT_PHOTO_RESIZER)).toBe(true)
    expect(isPhotoResizer('https://img.mine.example/resize?src={url}')).toBe(true)
    expect(isPhotoResizer('https://img.mine.example/resize')).toBe(false)
    expect(isPhotoResizer('wsrv.nl/?url={url}')).toBe(false)
  })
})
