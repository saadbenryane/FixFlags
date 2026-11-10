'use client'

import { NavLink } from '@/components/layout/nav-link'
import { Logo } from '@/components/brand/Logo'
import { BRAND } from '@/lib/marketing/copy-barrel'
import { LEGAL_LINKS } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_FOOTER_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'
import { FooterThemeToggle } from '@/components/layout/FooterThemeToggle'
import { Container } from '@/components/ui/container'
import { CookiePreferencesButton } from '@/components/analytics/CookiePreferencesButton'

export function MinimalFooter() {
  return (
    <footer>
      <Container className="flex flex-col gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Logo variant="lockup" size="sm" href="/" />
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <CookiePreferencesButton className={NAV_LINK_FOOTER_BASE} />
          <FooterThemeToggle />
          {LEGAL_LINKS.map((link) => (
            <span key={link.href} className="inline-flex items-center">
              <NavLink
                href={link.href}
                className={NAV_LINK_FOOTER_BASE}
                activeClassName={NAV_LINK_ACTIVE}
                inactiveClassName={NAV_LINK_INACTIVE}
              >
                {link.label}
              </NavLink>
            </span>
          ))}
        </div>
      </Container>
    </footer>
  )
}
