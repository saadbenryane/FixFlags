import { describe, expect, it } from 'vitest'
import { BRAND, SEO } from '../copy'
import { DEFAULT_OG_IMAGE, buildIndexableMetadata, buildPageMetadata } from '../metadata'

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
      images: ['https://fixflags.com/og.jpg'],
    })
  })

  it('includes canonical, robots, OG, and Twitter for every SEO registry page', () => {
    for (const [key, copy] of Object.entries(SEO)) {
      const metadata =
        key === 'home'
          ? buildPageMetadata('home', '/')
          : buildIndexableMetadata({
              title: copy.title,
              description: copy.description,
              path: `/seo-test/${key}`,
            })

      expect(metadata.alternates?.canonical, key).toBeTruthy()
      expect(metadata.robots, key).toMatchObject({ index: true, follow: true })
      const images = metadata.openGraph?.images
      const imageCount = Array.isArray(images) ? images.length : images ? 1 : 0
      expect(imageCount, key).toBeGreaterThan(0)
      expect(
        metadata.twitter && 'card' in metadata.twitter ? metadata.twitter.card : undefined,
        key,
      ).toBe('summary_large_image')
    }
  })
})
