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
  { path: '/waitlist', seoKey: 'waitlist', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/how-it-works', seoKey: 'howItWorks', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', seoKey: 'pricing', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/faq', seoKey: 'faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/help', seoKey: 'help', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/docs', seoKey: 'docs', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/docs/getting-started', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/reports', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/troubleshooting', seoKey: 'docs', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/examples', seoKey: 'examples', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/changelog', seoKey: 'changelog', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/blog', seoKey: 'blog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/samples', seoKey: 'samples', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/privacy', seoKey: 'privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', seoKey: 'terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/tools/meta-preview', seoKey: 'metaPreview', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/tools/placeholder-detector', seoKey: 'placeholderDetector', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/issues', seoKey: 'issues', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/partners', seoKey: 'partners', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/roast', seoKey: 'roast', priority: 0.6, changeFrequency: 'monthly' },
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
      { path: '/', label: 'Home', note: 'Free product review, Flags, fix prompts' },
      { path: '/how-it-works', label: 'How it works', note: 'URL-based Product Review workflow' },
      { path: '/samples', label: 'Sample report', note: 'Full example output' },
      { path: '/pricing', label: 'Pricing', note: 'Free vs Pro plans' },
      { path: '/docs', label: 'Documentation', note: 'Product Reviews, reports, and update reviews' },
      {
        path: '/docs/getting-started',
        label: 'Getting started',
        note: 'Product review → Fix → Update review workflow',
      },
      { path: '/docs/reports', label: 'Finish Plans and reports', note: 'Flags, evidence, scores, and sharing' },
      { path: '/docs/troubleshooting', label: 'Troubleshooting', note: 'Setup and runtime recovery' },
      { path: '/partners', label: 'Expert program', note: 'Lovable and Bolt delivery partners' },
      { path: '/help', label: 'Help Center', note: 'Billing, account, failed checks, and contact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { path: '/help', label: 'Help Center', note: 'Searchable guides + chat' },
      { path: '/faq', label: 'FAQ', note: 'Product Reviews, Flags, and plans' },
      { path: '/privacy', label: 'Privacy' },
      { path: '/terms', label: 'Terms' },
    ],
  },
  {
    title: 'Free Tools',
    links: [
      { path: '/tools/meta-preview', label: 'Meta Preview Tool', note: 'Check social preview tags on any URL' },
      { path: '/tools/placeholder-detector', label: 'Placeholder Copy Detector', note: 'Find lorem ipsum, TODOs, AI template artifacts' },
    ],
  },
  {
    title: 'Flag Library',
    links: [
      { path: '/issues', label: 'Issues we detect', note: 'Frequency, fixes, and affected frameworks' },
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
