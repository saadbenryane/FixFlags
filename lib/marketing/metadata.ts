import type { Metadata } from 'next'
import { BRAND, SEO, SITE_URL } from './copy'

const DEFAULT_OG_IMAGE = {
  url: '/og.jpg',
  width: 1200,
  height: 630,
  alt: BRAND.tagline,
  type: 'image/jpeg',
} as const

type IndexableMetadataInput = {
  title: string
  description: string
  path: string
  openGraphType?: 'website' | 'article'
  openGraphTitle?: string
  publishedTime?: string
  robots?: Metadata['robots']
  images?: readonly (typeof DEFAULT_OG_IMAGE | { url: string; width: number; height: number })[]
}

export function buildIndexableMetadata(input: IndexableMetadataInput): Metadata {
  const url = `${SITE_URL}${input.path}`
  const ogTitle = input.openGraphTitle ?? input.title
  const images = input.images ?? [DEFAULT_OG_IMAGE]
  const twitterImage = images[0]?.url.startsWith('http')
    ? images[0].url
    : `${SITE_URL}${images[0]?.url ?? DEFAULT_OG_IMAGE.url}`

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: input.robots ?? { index: true, follow: true },
    openGraph: {
      title: ogTitle,
      description: input.description,
      type: input.openGraphType ?? 'website',
      url,
      siteName: BRAND.name,
      images: [...images],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: input.description,
      images: [twitterImage],
    },
  }
}

export function buildPageMetadata(
  page: keyof typeof SEO,
  path: string
): Metadata {
  const { title, description } = SEO[page]
  return buildIndexableMetadata({ title, description, path })
}

export function buildBlogPostMetadata(post: {
  slug: string
  title: string
  excerpt: string
  date: string
}): Metadata {
  return buildIndexableMetadata({
    title: `${post.title}: ${BRAND.name} Blog`,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    openGraphType: 'article',
    openGraphTitle: post.title,
    publishedTime: post.date,
  })
}

export function buildIssuePageMetadata(input: {
  checkId: string
  title: string
  description: string
}): Metadata {
  return buildIndexableMetadata({
    title: input.title,
    description: input.description,
    path: `/issues/${input.checkId}`,
    openGraphType: 'article',
  })
}

export { DEFAULT_OG_IMAGE }
