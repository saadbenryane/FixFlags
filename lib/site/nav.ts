import { BRAND } from '@/lib/marketing/copy/brand'

export const MARKETING_LINKS = [
  { href: '/how-it-works', label: 'Product' },
  { href: '/ai-builders', label: 'For AI builders' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/changelog', label: 'Changelog' },
] as const

export const MARKETING_NAV = [...MARKETING_LINKS] as const

/** Three groups, separated by whitespace. Each destination appears once. */
export const FOOTER_COLUMNS = {
  product: [
    { href: '/how-it-works', label: 'Product' },
    { href: '/ai-builders', label: 'For AI builders' },
    { href: '/for-agencies', label: 'For agencies' },
    { href: '/coverage', label: 'What it checks' },
    { href: '/compare', label: 'Compare' },
    { href: '/pricing', label: 'Pricing' },
  ],
  resources: [
    { href: '/docs', label: 'Docs' },
    { href: '/help', label: 'Help Center' },
    { href: '/guides', label: 'Website guides' },
    { href: '/tools', label: 'Free tools' },
    { href: '/blog', label: 'Blog' },
    { href: '/changelog', label: 'Changelog' },
  ],
  company: [
    { href: `mailto:${BRAND.supportEmail}`, label: 'Contact' },
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
