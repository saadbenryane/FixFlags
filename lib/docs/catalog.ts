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
    description: 'Enter a URL, open a Site board, and keep watching.',
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
    description: 'Analyze a website URL, verify a Flag, and keep watching.',
    source: 'getting-started.md',
    order: 1,
    headings: [
      { id: 'before-you-start', title: 'Before you start' },
      { id: 'check-a-website', title: 'Check a website' },
      { id: 'shopify-connection', title: 'Shopify connection' },
      { id: 'verify-a-flag', title: 'Verify a Flag' },
      { id: 'keep-watching', title: 'Keep watching' },
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
    title: 'Flags and proof',
    description: 'Coverage, Flags, Verify, Watch, and the Shopify connection.',
    source: 'reports.md',
    order: 2,
    headings: [
      { id: 'site-board', title: 'Site board' },
      { id: 'flags-and-evidence', title: 'Flags and evidence' },
      { id: 'verify', title: 'Verify' },
      { id: 'watch', title: 'Watch' },
      { id: 'shopify-connection', title: 'Shopify connection' },
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
