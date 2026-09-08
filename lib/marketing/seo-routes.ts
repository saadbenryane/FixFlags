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
  { path: '/protect', seoKey: 'protect', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/install', seoKey: 'install', priority: 0.9, changeFrequency: 'weekly' },
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
      { path: '/', label: 'Home', note: 'Your website, looked after' },
      { path: '/protect', label: 'Protect', note: 'Purchase path health and video proof' },
      { path: '/install', label: 'Install', note: 'Install FixFlags on Shopify' },
      { path: '/how-it-works', label: 'How it works', note: 'Walk, video, alert' },
      { path: '/pricing', label: 'Pricing', note: 'Free website analysis. Paid plans when you need more' },
      { path: '/docs', label: 'Documentation', note: 'Install, walk, and alerts' },
      {
        path: '/docs/getting-started',
        label: 'Getting started',
        note: 'Install on Shopify and watch the first walk',
      },
      { path: '/docs/reports', label: 'Paths and proof', note: 'Health, video, Recheck, and Improve' },
      { path: '/docs/troubleshooting', label: 'Troubleshooting', note: 'Password gates, missing video, uninstall' },
      { path: '/help', label: 'Help Center', note: 'Install, alerts, and contact' },
      { path: '/help/getting-started/first-check', label: 'Install on Shopify' },
      { path: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
      { path: '/help/checks-and-reports/why-check-failed', label: 'Why a walk is Unclear or failed' },
      { path: '/help/account/contact-us', label: 'Contact support' },
    ],
  },
  {
    title: 'Support',
    links: [
      { path: '/help', label: 'Help Center', note: 'Searchable guides + chat' },
      { path: '/faq', label: 'FAQ', note: 'Purchase path, health, and what is free' },
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
