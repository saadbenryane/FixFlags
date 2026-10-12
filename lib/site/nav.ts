import { BRAND } from '@/lib/marketing/copy/brand'

export const MARKETING_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
] as const

export const MARKETING_NAV = [...MARKETING_LINKS] as const

export const FOOTER_COLUMNS = {
  product: [
    { href: '/how-it-works', label: 'How it works' },
    { href: '/coverage', label: 'What it checks' },
    { href: '/samples', label: 'Product sample' },
    { href: '/use-cases', label: 'Use cases' },
    { href: '/integrations', label: 'Integrations' },
    { href: '/pricing', label: 'Pricing' },
  ],
  resources: [
    { href: '/docs', label: 'Docs' },
    { href: '/docs/fix-with-ai', label: 'Fix with your AI' },
    { href: '/help', label: 'Help Center' },
    { href: '/faq', label: 'FAQ' },
    { href: '/blog', label: 'Blog' },
    { href: '/tools/meta-preview', label: 'Meta Preview Tool' },
    { href: '/tools/placeholder-detector', label: 'Placeholder Copy Detector' },
  ],
  company: [
    { href: '/blog/introducing-fixflags', label: 'Why we built FixFlags' },
    { href: '/changelog', label: 'Changelog' },
    { href: `mailto:${BRAND.supportEmail}`, label: 'Contact' },
  ],
  trust: [
    { href: '/security', label: 'Privacy and security' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms' },
  ],
} as const

export const ADMIN_NAV = [
  { href: '/admin', label: 'Metrics' },
  { href: '/admin/operating-plan', label: 'Operating Plan' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/audits', label: 'Audits' },
  { href: '/admin/shops', label: 'Shops' },
] as const

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const
