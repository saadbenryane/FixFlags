'use client'

import { NavLink } from '@/components/layout/nav-link'
import { Container } from '@/components/ui/container'
import { SETTINGS_NAV } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container variant="narrow" className="space-y-8 py-8">
      <nav
        className="flex flex-wrap gap-1 border-b border-border/60 pb-4"
        aria-label="Settings sections"
      >
        {SETTINGS_NAV.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            className={NAV_LINK_BASE}
            activeClassName={NAV_LINK_ACTIVE}
            inactiveClassName={NAV_LINK_INACTIVE}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </Container>
  )
}
