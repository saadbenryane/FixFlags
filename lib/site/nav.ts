import { BRAND } from '@/lib/marketing/copy'

export const MARKETING_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/#sample-review', label: 'Sample report' },
  { href: '/pricing', label: 'Pricing' },
] as const

export const MARKETING_NAV = MARKETING_LINKS

export const FOOTER_COLUMNS = {
  product: [
    { href: '/how-it-works', label: 'How it works' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/changelog', label: 'Changelog' },
  ],
  resources: [
    { href: '/help', label: 'Help Center' },
    { href: '/help/mcp', label: 'MCP guide' },
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

export const ADMIN_NAV = [
  { href: '/admin', label: 'Metrics' },
  { href: '/admin/operating-plan', label: 'Operating Plan' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audits', label: 'Audits' },
] as const

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const
