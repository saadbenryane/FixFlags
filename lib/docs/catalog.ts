import type { Metadata } from 'next'
import type { HelpArticleSlug } from '@/lib/help/types'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'

export type DocsPageKey =
  | 'home'
  | 'getting-started'
  | 'reports'
  | 'troubleshooting'

export type DocsNavigationGroup = 'Start' | 'Use FixFlags' | 'Reference'

export interface DocsHeadingDefinition {
  id: string
  title: string
  level?: 2 | 3
}

export interface DocsPageDefinition {
  key: DocsPageKey
  path: string
  group: DocsNavigationGroup
  title: string
  description: string
  source?: string
  order: number
  headings: readonly DocsHeadingDefinition[]
  relatedHelpSlugs?: readonly HelpArticleSlug[]
}

export const DOCS_PAGES: readonly DocsPageDefinition[] = [
  {
    key: 'home',
    path: '/docs',
    group: 'Start',
    title: 'FixFlags documentation',
    description: 'Install on Shopify, walk the purchase path, and know when customers cannot buy.',
    source: 'index.md',
    order: 0,
    headings: [
      { id: 'quick-start', title: 'Quick start' },
      { id: 'product-loop', title: 'The product loop' },
      { id: 'choose-your-path', title: 'Choose your path' },
    ],
    relatedHelpSlugs: ['first-check', 'reading-your-report', 'flag-fix-recheck', 'free-vs-pro'],
  },
  {
    key: 'getting-started',
    path: '/docs/getting-started',
    group: 'Start',
    title: 'Getting started',
    description: 'Install on Shopify, watch the first walk, and recheck after a fix.',
    source: 'getting-started.md',
    order: 1,
    headings: [
      { id: 'before-you-start', title: 'Before you start' },
      { id: 'install-on-shopify', title: 'Install on Shopify' },
      { id: 'watch-the-first-walk', title: 'Watch the first walk' },
      { id: 'recheck-after-a-fix', title: 'Recheck after a fix' },
    ],
    relatedHelpSlugs: [
      'first-check',
      'claiming-a-report',
      'anonymous-report-access',
      'flag-fix-recheck',
    ],
  },
  {
    key: 'reports',
    path: '/docs/reports',
    group: 'Use FixFlags',
    title: 'Paths and proof',
    description: 'Path health, verification video, Recheck, Improve, and alerts.',
    source: 'reports.md',
    order: 2,
    headings: [
      { id: 'path-health', title: 'Path health' },
      { id: 'watch-verification', title: 'Watch verification' },
      { id: 'recheck', title: 'Recheck' },
      { id: 'improve', title: 'Improve' },
      { id: 'alerts', title: 'Alerts' },
    ],
    relatedHelpSlugs: [
      'reading-your-report',
      'scores-and-severity',
      'finish-plan-vs-fix-list',
      'evidence-and-screenshots',
    ],
  },
  {
    key: 'troubleshooting',
    path: '/docs/troubleshooting',
    group: 'Reference',
    title: 'Troubleshooting',
    description: 'Install errors, password gates, missing video, recheck caps, and uninstall.',
    source: 'troubleshooting.md',
    order: 7,
    headings: [
      { id: 'install-did-not-finish', title: 'Install did not finish' },
      { id: 'no-buyable-product', title: 'No buyable product' },
      { id: 'password-or-bot-wall', title: 'Password or bot wall' },
      { id: 'walk-still-in-progress', title: 'Walk still in progress' },
      { id: 'recheck-cap', title: 'Recheck cap' },
      { id: 'uninstall', title: 'Uninstall' },
    ],
    relatedHelpSlugs: [
      'why-check-failed',
      'public-urls-only',
      'stuck-running-review',
      'oauth-sign-in-issues',
      'payment-past-due',
      'contact-us',
    ],
  },
] as const

export const DOCS_GROUPS: readonly DocsNavigationGroup[] = [
  'Start',
  'Use FixFlags',
  'Reference',
]

export function getDocsPage(key: DocsPageKey) {
  const page = DOCS_PAGES.find((candidate) => candidate.key === key)
  if (!page) throw new Error(`Unknown docs page: ${key}`)
  return page
}

export function getDocsPageByPath(path: string) {
  return DOCS_PAGES.find((candidate) => candidate.path === path)
}

export function buildDocsMetadata(page: DocsPageDefinition): Metadata {
  return buildIndexableMetadata({
    title: `${page.title} | FixFlags Docs`,
    description: page.description,
    path: page.path,
    openGraphType: 'article',
    openGraphTitle: page.title,
  })
}

export { docsStructuredData } from '@/lib/marketing/structured-data'

export function slugifyDocsHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[`_*[\]()]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
