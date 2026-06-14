import type { Metadata } from 'next'
import { BRAND, SEO, SITE_URL } from './copy'

export function buildPageMetadata(
  page: keyof typeof SEO,
  path: string
): Metadata {
  const { title, description } = SEO[page]
  const url = `${SITE_URL}${path}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      siteName: BRAND.name,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Your agent built it. QualityOS checks it.' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
