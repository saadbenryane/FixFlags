/** Routes that should match exactly, not by prefix. */
const EXACT_MATCH_ROUTES = ['/dashboard', '/admin', '/settings'] as const

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/products/')
  }
  if (EXACT_MATCH_ROUTES.includes(href as (typeof EXACT_MATCH_ROUTES)[number])) {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
