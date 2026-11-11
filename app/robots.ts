import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing/copy-barrel'

const PRIVATE_PREFIXES = [
  '/admin',
  '/api',
  '/demo',
  '/dashboard',
  '/settings',
  '/billing',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/post-login',
  '/two-factor',
  '/onboarding',
  '/cli',
  '/sites',
  '/products',
  '/shopify',
  '/integrations/connect',
] as const

// Search crawlers and user-directed fetchers can discover the public site.
// Other AI uses follow the existing managed production restrictions.
// A named user-agent group fully replaces the `*` group for that bot, so each must repeat the
// private-prefix exclusions or it would otherwise be free to crawl them.
const AI_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
] as const

const RESTRICTED_AI_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  // Google combines Gemini grounding and training under this control.
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
      ...RESTRICTED_AI_CRAWLERS.map((userAgent) => ({ userAgent, disallow: '/' })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
