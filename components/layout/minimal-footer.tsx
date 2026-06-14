'use client'

import { NavLink } from '@/components/layout/nav-link'
import { BRAND } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const

export function MinimalFooter() {
  return (
    <footer className="border-t">
      <Container className="py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <span>© 2026 {BRAND.name}</span>
        <div className="flex items-center gap-1">
          {LEGAL_LINKS.map((link, index) => (
            <span key={link.href} className="inline-flex items-center">
              {index > 0 && (
                <span className="mx-1 text-muted-foreground/50 select-none" aria-hidden>
                  ·
                </span>
              )}
              <NavLink
                href={link.href}
                className="link-underline-grow min-h-[44px] inline-flex items-center px-2 py-2 transition-colors duration-200 hover:text-foreground"
                activeClassName="text-foreground font-medium"
                inactiveClassName="text-muted-foreground"
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
