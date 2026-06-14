export const MARKETING_LINKS = [
  { href: '/samples', label: 'Live sample' },
  { href: '/examples', label: 'Examples' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs/mcp', label: 'MCP' },
  { href: '/faq', label: 'FAQ' },
] as const

const SECONDARY_MARKETING_HREFS = new Set(['/examples', '/pricing', '/docs/mcp'])

/** Compact marketing links shown alongside app nav on audit/dashboard pages. */
export const SECONDARY_MARKETING_NAV = MARKETING_LINKS.filter((link) =>
  SECONDARY_MARKETING_HREFS.has(link.href)
)

export const MARKETING_NAV = MARKETING_LINKS

export const APP_NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
  { href: '/billing', label: 'Billing' },
] as const

export const ADMIN_NAV = [
  { href: '/admin', label: 'Metrics' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audits', label: 'Audits' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/expert-reviews', label: 'Expert reviews' },
] as const

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const

export const FOOTER_LINKS = [...MARKETING_LINKS, ...LEGAL_LINKS] as const

export const SETTINGS_NAV = [
  { href: '/settings', label: 'Settings' },
  { href: '/settings/api-keys', label: 'API Keys' },
  { href: '/billing', label: 'Billing' },
] as const
