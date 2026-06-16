import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing/copy'

const PRIVATE_PREFIXES = [
  '/admin',
  '/api',
  '/dashboard',
  '/settings',
  '/billing',
  '/compare',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/post-login',
] as const

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL.replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...PRIVATE_PREFIXES],
      },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
