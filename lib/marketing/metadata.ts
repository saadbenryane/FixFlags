import type { Metadata } from 'next'
import { BRAND, SEO, SITE_URL } from './copy'

const DEFAULT_OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: BRAND.tagline,
} as const

export function buildPageMetadata(
  page: keyof typeof SEO,
  path: string
): Metadata {
  const { title, description } = SEO[page]
  const url = `${SITE_URL}${path}`

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      siteName: BRAND.name,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  }
}

export { DEFAULT_OG_IMAGE }
