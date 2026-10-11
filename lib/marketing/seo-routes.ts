import { SEO } from './copy'
import { PUBLIC_OFFER } from './copy/public-offer'

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
  { path: '/integrations', seoKey: 'integrations', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/waitlist', seoKey: 'waitlist', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/coverage', seoKey: 'coverage', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/security', seoKey: 'security', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/use-cases', seoKey: 'useCases', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/how-it-works', seoKey: 'howItWorks', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', seoKey: 'pricing', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/request-demo', seoKey: 'requestDemo', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/faq', seoKey: 'faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/help', seoKey: 'help', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/docs', seoKey: 'docs', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/docs/getting-started', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/site-care', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/fix-with-ai', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/troubleshooting', seoKey: 'docs', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs/integrations', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/integrations/shopify', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/integrations/google-analytics', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/integrations/google-search-console', seoKey: 'docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/changelog', seoKey: 'changelog', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/blog', seoKey: 'blog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/samples', seoKey: 'samples', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/privacy', seoKey: 'privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', seoKey: 'terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/tools/meta-preview', seoKey: 'metaPreview', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/tools/placeholder-detector', seoKey: 'placeholderDetector', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/issues', seoKey: 'issues', priority: 0.6, changeFrequency: 'weekly' },

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
      { path: '/integrations', label: 'Integrations', note: 'Shopify, Analytics, and Search Console available; other sources marked as planned' },
      { path: '/coverage', label: 'What FixFlags checks', note: 'Coverage, setup, and evidence limits' },
      { path: '/security', label: 'Privacy and security', note: 'Evidence access, AI processing, and control' },
      { path: '/use-cases', label: 'Use cases', note: 'For people responsible for websites' },
      { path: '/how-it-works', label: 'How it works', note: 'URL in, Site board, Flags, Verify, Watch' },
      { path: '/pricing', label: 'Pricing', note: PUBLIC_OFFER.free },
      { path: '/request-demo', label: 'Request a demo', note: 'A walkthrough of checks, evidence, and next steps for your website' },
      { path: '/docs', label: 'Documentation', note: 'Site checks, Flags, Verify, and Watch' },
      {
        path: '/docs/getting-started',
        label: 'Getting started',
        note: 'Enter a URL and open the Site board',
      },
      { path: '/docs/site-care', label: 'Site care', note: 'Coverage, evidence, Verify, and Watch' },
      { path: '/docs/fix-with-ai', label: 'Fix with your AI', note: 'Use a fix prompt and learn about MCP' },
      { path: '/docs/integrations', label: 'Integration guides' },
      { path: '/docs/integrations/shopify', label: 'Shopify', note: 'Connect a store and verify checkout entry' },
      { path: '/docs/integrations/google-analytics', label: 'Google Analytics', note: 'Page-session context' },
      { path: '/docs/integrations/google-search-console', label: 'Google Search Console', note: 'Query, impression, and click context' },
      { path: '/docs/troubleshooting', label: 'Troubleshooting', note: 'Blocked pages and incomplete coverage' },
      { path: '/help', label: 'Help Center', note: 'URL checks, Sites, and contact' },
      { path: '/help/getting-started/analyze-a-website', label: 'Analyze a website' },
      { path: '/help/account-and-billing/free-and-pro', label: 'Free vs Pro' },
      { path: '/help/troubleshooting/check-failed-or-stuck', label: 'A check failed or is stuck' },
      { path: '/help/troubleshooting/contact-support', label: 'Contact support' },
    ],
  },
  {
    title: 'Support',
    links: [
      { path: '/help', label: 'Help Center', note: 'Searchable guides + chat' },
      { path: '/faq', label: 'FAQ', note: 'Site checks, Flags, Watch, and Shopify as a connection' },
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
    title: 'Updates',
    links: [
      { path: '/blog', label: 'Blog' },
      { path: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Optional',
    optional: true,
    links: [
      { path: '/samples', label: 'Product sample', note: 'One evidence-backed Site and Flag' },
    ],
  },
] as const
