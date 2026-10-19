import type { Metadata } from 'next'
import type { HelpArticleSlug } from '@/lib/help/types'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'

export type DocsPageKey =
  | 'home'
  | 'getting-started'
  | 'site-care'
  | 'fix-with-ai'
  | 'mcp'
  | 'integrations'
  | 'github'
  | 'shopify'
  | 'google-analytics'
  | 'google-search-console'
  | 'troubleshooting'

export type DocsNavigationGroup = 'Start' | 'Use FixFlags' | 'Integrations' | 'Reference'

export interface DocsHeadingDefinition {
  id: string
  title: string
  level?: 2 | 3
  aliases?: readonly string[]
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
    description: 'Check your website, understand the results, and fix problems.',
    source: 'index.md',
    order: 0,
    headings: [
      { id: 'quick-start', title: 'Quick start' },
      { id: 'the-product-loop', title: 'The product loop' },
      { id: 'choose-your-path', title: 'Choose your path' },
    ],
    relatedHelpSlugs: ['analyze-a-website', 'read-site-coverage', 'verify-a-flag', 'free-and-pro'],
  },
  {
    key: 'getting-started',
    path: '/docs/getting-started',
    group: 'Start',
    title: 'Getting started',
    description: 'Run your first check, save your website, and check a fix.',
    source: 'getting-started.md',
    order: 1,
    headings: [
      { id: 'before-you-start', title: 'Before you start' },
      { id: 'analyze-a-website', title: 'Analyze a website' },
      { id: 'verify-a-flag', title: 'Verify a Flag' },
      { id: 'keep-watching', title: 'Keep watching' },
      { id: 'connections', title: 'Connections', aliases: ['shopify-connection'] },
      { id: 'get-help', title: 'Get help' },
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
    title: 'Understand your results',
    description: 'Read problems, check fixes, and follow your website over time.',
    source: 'site-care.md',
    order: 2,
    headings: [
      { id: 'site-board', title: 'Site board' },
      { id: 'workspace', title: 'Workspace' },
      { id: 'flags-and-evidence', title: 'Flags and evidence' },
      { id: 'verify', title: 'Verify' },
      { id: 'watch', title: 'Watch' },
      { id: 'automatic-account-checks', title: 'Automatic account checks' },
      { id: 'connections', title: 'Connections', aliases: ['shopify-connection'] },
    ],
    relatedHelpSlugs: [
      'read-site-coverage',
      'read-a-flag',
      'verify-a-flag',
      'weekly-watch',
    ],
  },
  {
    key: 'fix-with-ai',
    path: '/docs/fix-with-ai',
    group: 'Use FixFlags',
    title: 'Fix with your AI',
    description: 'Copy a suggested fix into your AI tool and check the result.',
    source: 'fix-with-ai.md',
    order: 2.5,
    headings: [
      { id: 'use-your-fix-prompt', title: 'Use your fix prompt' },
      { id: 'verify-the-fix', title: 'Verify the fix' },
      { id: 'what-is-mcp', title: 'What is MCP?' },
      { id: 'get-started', title: 'Get started' },
    ],
    relatedHelpSlugs: ['save-your-site', 'verify-a-flag'],
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
    description: 'Connect GitHub and explore other integrations coming soon.',
    source: 'integrations.md', order: 4,
    headings: [
      { id: 'available-integrations', title: 'Available integrations' },
      { id: 'planned-integrations', title: 'Planned integrations' },
      { id: 'connect-to-a-site', title: 'Connect to a Site' },
      { id: 'context-and-proof', title: 'Context and proof' },
    ],
    relatedHelpSlugs: ['connect-shopify', 'connect-google-data'],
  },
  ...([
    { key: 'github', title: 'GitHub', description: 'Authorize your GitHub account, hand off a fix prompt, and verify your deployed change.', relatedHelpSlugs: ['verify-a-flag'], order: 4.5 },
    { key: 'shopify', title: 'Shopify', description: 'Coming soon: store and selected product-path context.', relatedHelpSlugs: ['connect-shopify', 'shopify-access-and-removal'], order: 5 },
    { key: 'google-analytics', title: 'Google Analytics', description: 'Coming soon: traffic context beside matching checked pages.', relatedHelpSlugs: ['connect-google-data'], order: 6 },
    { key: 'google-search-console', title: 'Google Search Console', description: 'Coming soon: search and recorded indexing context.', relatedHelpSlugs: ['connect-google-data'], order: 7 },
  ] as const).map((integration): DocsPageDefinition => ({
    ...integration, path: `/docs/integrations/${integration.key}`, group: 'Integrations',
    parentKey: 'integrations', source: `${integration.key}.md`,
    headings: [
      { id: 'what-it-adds', title: 'What it adds' },
      { id: 'before-you-connect', title: 'Before you connect' },
      { id: 'connect', title: 'Connect' },
      { id: 'confirm-the-connection', title: 'Confirm the connection' },
      { id: 'coverage-and-limitations', title: 'Coverage and limitations' },
      { id: 'permissions-and-data', title: 'Permissions and data' },
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
      { id: 'page-asks-for-a-password-or-human-check', title: 'Page asks for a password or human check' },
      { id: 'verify-is-still-in-progress', title: 'Verify is still in progress' },
      { id: 'connections', title: 'Connections', aliases: ['shopify-connection'] },
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
