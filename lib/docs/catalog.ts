import type { Metadata } from 'next'
import type { HelpArticleSlug } from '@/lib/help/types'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'

export type DocsPageKey =
  | 'home'
  | 'getting-started'
  | 'site-care'
  | 'mcp'
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
    relatedHelpSlugs: ['analyze-a-website', 'read-site-coverage', 'verify-a-flag', 'free-and-pro'],
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
      'analyze-a-website',
      'save-your-site',
      'connect-shopify',
      'verify-a-flag',
    ],
  },
  {
    key: 'site-care',
    path: '/docs/site-care',
    group: 'Use FixFlags',
    title: 'Flags and proof',
    description: 'Coverage, Flags, Verify, Watch, and the Shopify connection.',
    source: 'site-care.md',
    order: 2,
    headings: [
      { id: 'site-board', title: 'Site board' },
      { id: 'flags-and-evidence', title: 'Flags and evidence' },
      { id: 'verify', title: 'Verify' },
      { id: 'watch', title: 'Watch' },
      { id: 'shopify-connection', title: 'Shopify connection' },
    ],
    relatedHelpSlugs: [
      'read-site-coverage',
      'read-a-flag',
      'verify-a-flag',
      'weekly-watch',
    ],
  },
  {
    key: 'mcp',
    path: '/docs/mcp',
    group: 'Use FixFlags',
    title: 'MCP for coding agents',
    description: 'Connect a coding agent and ask FixFlags to independently verify an owned Outcome.',
    source: 'mcp.md',
    order: 3,
    headings: [
      { id: 'what-mcp-does', title: 'What MCP does' },
      { id: 'connect', title: 'Connect' },
      { id: 'tools', title: 'Tools' },
      { id: 'async-runs', title: 'Async runs' },
      { id: 'security-and-independence', title: 'Security and independence' },
    ],
  },
  {
    key: 'troubleshooting',
    path: '/docs/troubleshooting',
    group: 'Reference',
    title: 'Troubleshooting',
    description: 'Recover from blocked, delayed, or failed checks and connections.',
    source: 'troubleshooting.md',
    order: 7,
    headings: [
      { id: 'analysis-did-not-finish', title: 'Analysis did not finish' },
      { id: 'site-could-not-be-reached', title: 'Site could not be reached' },
      { id: 'password-or-bot-wall', title: 'Password or bot wall' },
      { id: 'verify-is-still-in-progress', title: 'Verify is still in progress' },
      { id: 'shopify-connection', title: 'Shopify connection' },
      { id: 'contact-support', title: 'Contact support' },
    ],
    relatedHelpSlugs: [
      'check-failed-or-stuck',
      'coverage-limitations',
      'connect-shopify',
      'manage-an-existing-subscription',
      'contact-support',
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
