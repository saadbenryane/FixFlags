import { BRAND } from '@/lib/marketing/copy'

export const MARKETING_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
] as const

const SECONDARY_MARKETING_HREFS = new Set(['/pricing', '/examples'])

/** Compact marketing links shown alongside app nav on audit/dashboard pages. */
export const SECONDARY_MARKETING_NAV = MARKETING_LINKS.filter((link) =>
  SECONDARY_MARKETING_HREFS.has(link.href)
)

export const MARKETING_NAV = MARKETING_LINKS

export const FOOTER_COLUMNS = {
  product: [
    { href: '/how-it-works', label: 'How it works' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/changelog', label: 'Changelog' },
  ],
  resources: [
    { href: '/docs/mcp', label: 'Documentation' },
    { href: '/examples', label: 'Examples' },
    { href: '/faq', label: 'FAQ' },
    { href: '/samples', label: 'Sample report' },
    { href: '/blog', label: 'Blog' },
  ],
  company: [
    { href: `mailto:${BRAND.supportEmail}?subject=Careers`, label: 'Careers' },
    { href: `mailto:${BRAND.supportEmail}`, label: 'Contact' },
    { href: '/privacy', label: 'Privacy Policy' },
  ],
} as const

export const APP_NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
  { href: '/billing', label: 'Billing' },
] as const

export const ADMIN_NAV = [
  { href: '/admin', label: 'Metrics' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audits', label: 'Audits' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/expert-reviews', label: 'Expert reviews' },
] as const

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const

export const SUPPORT_LINK = {
  href: `mailto:${BRAND.supportEmail}`,
  label: 'Support',
} as const

export const SETTINGS_NAV = [
  { href: '/settings', label: 'Settings' },
  { href: '/settings/api-keys', label: 'API Keys' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/billing', label: 'Billing' },
] as const
