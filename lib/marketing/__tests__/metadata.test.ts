import { describe, expect, it } from 'vitest'
import { BRAND } from '../copy'
import { DEFAULT_OG_IMAGE, buildPageMetadata } from '../metadata'

describe('site share metadata', () => {
  it('points Open Graph and Twitter cards at the 1200x630 brand artwork', () => {
    expect(DEFAULT_OG_IMAGE).toEqual({
      url: '/og.jpg',
      width: 1200,
      height: 630,
      alt: BRAND.tagline,
      type: 'image/jpeg',
    })

    const home = buildPageMetadata('home', '/')
    expect(home.openGraph?.images).toEqual([DEFAULT_OG_IMAGE])
    expect(home.twitter).toMatchObject({
      card: 'summary_large_image',
      images: ['/og.jpg'],
    })
  })
})
