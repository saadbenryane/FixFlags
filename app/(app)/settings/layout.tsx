'use client'

import { NavLink } from '@/components/layout/nav-link'
import { SETTINGS_NAV } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <nav className="flex flex-wrap gap-2 pb-2">
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
    </div>
  )
}
