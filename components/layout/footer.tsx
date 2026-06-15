'use client'

import { AuditCtaBlock } from '@/components/marketing/AuditCtaBlock'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { NavLink } from '@/components/layout/nav-link'
import { BRAND, FINAL_CTA } from '@/lib/marketing/copy'
import { FOOTER_LINKS } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_FOOTER_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'
import { Container } from '@/components/ui/container'

export function Footer() {
  return (
    <footer className="bg-muted/35">
      <Container className="space-y-10 py-12">
        <AuditCtaBlock headline={FINAL_CTA.headline} trustLine={FINAL_CTA.trustLine} />

        <ThirdPartyAuditDisclaimer
          variant="compact"
          className="mx-auto max-w-prose text-center text-[10px] text-muted-foreground/70"
        />

        <div className="flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {BRAND.name}</span>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {FOOTER_LINKS.map((link, index) => (
              <span key={link.href} className="inline-flex items-center">
                {index > 0 && (
                  <span className="mx-1 select-none text-muted-foreground/50" aria-hidden>
                    ·
                  </span>
                )}
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
        </div>
      </Container>
    </footer>
  )
}
