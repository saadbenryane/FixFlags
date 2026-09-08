import { BRAND } from '@/lib/marketing/copy'

export const MARKETING_LINKS = [
  { href: '/#product', label: 'Product' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/install', label: 'For Shopify' },
  { href: '/docs', label: 'Docs' },
] as const

export const MARKETING_NAV = [...MARKETING_LINKS] as const

export const FOOTER_COLUMNS = {
  product: [
    { href: '/how-it-works', label: 'Product' },
    { href: '/install', label: 'Shopify' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/changelog', label: 'Changelog' },
  ],
  resources: [
    { href: '/install', label: 'Install' },
    { href: '/help', label: 'Help Center' },
    { href: '/docs', label: 'Docs' },
    { href: '/faq', label: 'FAQ' },
  ],
  company: [
    { href: `mailto:${BRAND.supportEmail}`, label: 'Contact' },
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
