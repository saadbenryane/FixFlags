import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing/copy'

const PRIVATE_PREFIXES = [
  '/admin',
  '/api',
  '/demo',
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

// AI crawlers we explicitly welcome onto the public site. A named user-agent
// group fully replaces the `*` group for that bot, so each must repeat the
// private-prefix exclusions or it would otherwise be free to crawl them.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'cohere-ai',
] as const

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL.replace(/\/$/, '')
  const disallow = [...PRIVATE_PREFIXES]

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
