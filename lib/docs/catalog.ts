import type { Metadata } from 'next'
import type { HelpArticleSlug } from '@/lib/help/types'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'

export type DocsPageKey =
  | 'home'
  | 'getting-started'
  | 'site-care'
  | 'mcp'
  | 'integrations'
  | 'shopify'
  | 'google-analytics'
  | 'google-search-console'
  | 'troubleshooting'

export type DocsNavigationGroup = 'Start' | 'Use FixFlags' | 'Integrations' | 'Reference'

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
  parentKey?: DocsPageKey
}

export const DOCS_PAGE_DEFINITIONS: readonly DocsPageDefinition[] = [
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
      { id: 'analyze-a-website', title: 'Analyze a website' },
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
    key: 'integrations', path: '/docs/integrations', group: 'Integrations',
    title: 'Integration guides',
    description: 'Connect store, traffic, and search data to the Site you own.',
    source: 'integrations.md', order: 4,
    headings: [
      { id: 'available-integrations', title: 'Available integrations' },
      { id: 'connect-to-a-site', title: 'Connect to a Site' },
      { id: 'context-and-proof', title: 'Context and proof' },
    ],
    relatedHelpSlugs: ['connect-shopify', 'connect-google-data'],
  },
  ...([
    { key: 'shopify', title: 'Shopify', description: 'Connect your store and verify selected purchase paths through checkout entry.', relatedHelpSlugs: ['connect-shopify', 'shopify-access-and-removal'], order: 5 },
    { key: 'google-analytics', title: 'Google Analytics', description: 'Add page-session context from a matching Analytics property.', relatedHelpSlugs: ['connect-google-data'], order: 6 },
    { key: 'google-search-console', title: 'Google Search Console', description: 'Add query, impression, and click context from a matching Search Console property.', relatedHelpSlugs: ['connect-google-data'], order: 7 },
  ] as const).map((integration): DocsPageDefinition => ({
    ...integration, path: `/docs/integrations/${integration.key}`, group: 'Integrations',
    parentKey: 'integrations', source: `${integration.key}.md`,
    headings: [
      { id: 'what-it-adds', title: 'What it adds' },
      { id: 'before-you-connect', title: 'Before you connect' },
      { id: 'permissions-and-data', title: 'Permissions and data' },
      { id: 'connect', title: 'Connect' },
      { id: 'confirm-the-connection', title: 'Confirm the connection' },
      { id: 'coverage-and-limitations', title: 'Coverage and limitations' },
      { id: 'reconnect-or-disconnect', title: 'Reconnect or disconnect' },
      { id: 'troubleshooting', title: 'Troubleshooting' },
      { id: 'get-help', title: 'Get help' },
    ],
  })),
  {
    key: 'troubleshooting',
    path: '/docs/troubleshooting',
    group: 'Reference',
    title: 'Troubleshooting',
    description: 'Recover from blocked, delayed, or failed checks and connections.',
    source: 'troubleshooting.md',
    order: 8,
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

/**
 * The docs FixFlags publishes.
 *
 * A page exists in `DOCS_PAGE_DEFINITIONS` and is absent from here while it advertises
 * a capability that is not proven. Navigation, search, the sitemap, and the route table
 * all read this list, so a withheld page is genuinely unreachable rather than merely
 * unlinked, and re-publishing it is a one-line change once the evidence exists.
 */
export const DOCS_PAGES: readonly DocsPageDefinition[] = DOCS_PAGE_DEFINITIONS.filter(
  (page) => page.key !== 'mcp' || MCP_IS_DISCOVERABLE
)

export const DOCS_GROUPS: readonly DocsNavigationGroup[] = [
  'Start',
  'Use FixFlags',
  'Integrations',
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
