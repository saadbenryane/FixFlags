'use client'

import { AuditInput } from '@/components/audit/AuditInput'
import { NavLink } from '@/components/layout/nav-link'
import { BRAND, HERO } from '@/lib/marketing/copy'
import { FOOTER_LINKS } from '@/lib/site/nav'
import { Container } from '@/components/ui/container'
import { Muted } from '@/components/ui/typography'

export function Footer() {
  return (
    <footer className="border-t">
      <Container className="py-10 space-y-10">
        <div className="mx-auto max-w-xl text-center space-y-4">
          <p className="font-display text-lg tracking-display">Audit your site</p>
          <AuditInput />
          <Muted>{HERO.trustLine}</Muted>
        </div>

        <div className="flex flex-col gap-4 pt-6 border-t text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {BRAND.name}</span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {FOOTER_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                className="link-underline-grow min-h-[44px] inline-flex items-center px-2 py-2 transition-colors duration-200 hover:text-foreground"
                activeClassName="text-foreground font-medium"
                inactiveClassName="text-muted-foreground"
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  )
}
