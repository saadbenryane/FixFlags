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
    description: 'Learn the Product review → Fix → Update review workflow and ship a stronger product.',
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
    description: 'Run your first product review, understand the result, and take the next action.',
    source: 'getting-started.md',
    order: 1,
    headings: [
      { id: 'before-you-start', title: 'Before you start' },
      { id: 'run-your-first-check', title: 'Run your first check' },
      { id: 'claim-your-report', title: 'Claim your report' },
      { id: 'fix-the-first-flag', title: 'Fix the first Flag' },
      { id: 'update-review', title: 'Update review' },
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
    title: 'Finish Plans and reports',
    description: 'Understand Flags, evidence, priorities, fix prompts, sharing, and update reviews.',
    source: 'reports.md',
    order: 2,
    headings: [
      { id: 'report-structure', title: 'Report structure' },
      { id: 'flags-and-evidence', title: 'Flags and evidence' },
      { id: 'scores-and-priority', title: 'Scores and priority' },
      { id: 'fix-prompts', title: 'Fix prompts' },
      { id: 'update-review-and-compare', title: 'Update review and compare' },
      { id: 'sharing-and-watch', title: 'Sharing and Watch' },
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
    description: 'Resolve authentication, URL, queue, timeout, configuration, and credential issues.',
    source: 'troubleshooting.md',
    order: 7,
    headings: [
      { id: 'sign-in-and-account-access', title: 'Sign-in and account access' },
      { id: 'product-review-access', title: 'Product review access' },
      { id: 'public-url-requirements', title: 'Public URL requirements' },
      { id: 'timeouts-and-queues', title: 'Timeouts and queues' },
      { id: 'report-recovery', title: 'Report recovery' },
      { id: 'get-help', title: 'Get help' },
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
