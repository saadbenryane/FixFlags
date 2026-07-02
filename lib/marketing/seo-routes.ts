import { SEO } from './copy'

export type SeoPageKey = keyof typeof SEO

export type IndexableRoute = {
  path: string
  seoKey: SeoPageKey
  priority: number
  changeFrequency: 'weekly' | 'monthly' | 'yearly'
}

/** Single registry for sitemap, llms.txt, and SEO guard checks. */
export const INDEXABLE_ROUTES: readonly IndexableRoute[] = [
  { path: '/', seoKey: 'home', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/how-it-works', seoKey: 'howItWorks', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', seoKey: 'pricing', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/faq', seoKey: 'faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/examples', seoKey: 'examples', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/changelog', seoKey: 'changelog', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/samples', seoKey: 'samples', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/docs/mcp', seoKey: 'mcp', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', seoKey: 'privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', seoKey: 'terms', priority: 0.3, changeFrequency: 'yearly' },
] as const

export const LLMS_TXT_PATH = '/llms.txt'

export type LlmsSection = {
  title: string
  links: ReadonlyArray<{ path: string; label: string; note?: string }>
  optional?: boolean
}

export const LLMS_SECTIONS: readonly LlmsSection[] = [
  {
    title: 'Product',
    links: [
      { path: '/', label: 'Home', note: 'Free first audit, graded report' },
      { path: '/how-it-works', label: 'How it works', note: 'Website checks and MCP workflow' },
      { path: '/samples', label: 'Sample report', note: 'Full example output' },
      { path: '/pricing', label: 'Pricing', note: 'Free vs Pro plans' },
      { path: '/docs/mcp', label: 'MCP docs', note: 'Cursor / Claude Code integration' },
    ],
  },
  {
    title: 'Support',
    links: [
      { path: '/faq', label: 'FAQ', note: 'Checks, Flags, plans, MCP' },
      { path: '/privacy', label: 'Privacy' },
      { path: '/terms', label: 'Terms' },
    ],
  },
  {
    title: 'Optional',
    optional: true,
    links: [
      { path: '/examples', label: 'Example reports', note: 'Illustrative audits of public sites' },
    ],
  },
] as const
