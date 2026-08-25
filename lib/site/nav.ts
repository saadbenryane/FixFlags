import { BRAND } from '@/lib/marketing/copy'

export const MARKETING_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/samples', label: 'Examples' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
] as const

export const MARKETING_NAV = MARKETING_LINKS

export const FOOTER_COLUMNS = {
  product: [
    { href: '/how-it-works', label: 'How it works' },
    { href: '/samples', label: 'Sample report' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/changelog', label: 'Changelog' },
  ],
  resources: [
    { href: '/roast', label: 'Website Roast' },
    { href: '/help', label: 'Help Center' },
    { href: '/docs', label: 'Documentation' },
    { href: '/examples', label: 'Examples' },
    { href: '/faq', label: 'FAQ' },
    { href: '/blog', label: 'Blog' },
  ],
  company: [
    { href: '/partners', label: 'Expert program' },
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
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/audits', label: 'Audits' },
] as const

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const
