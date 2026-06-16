import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { NavLink } from '@/components/layout/nav-link'
import { Container } from '@/components/ui/container'
import { BRAND, LANDING_PAGE } from '@/lib/marketing/copy'
import { LEGAL_LINKS } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_FOOTER_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'

export function Footer() {
  const { tagline, madeWith, columns } = LANDING_PAGE.footer

  return (
    <footer className="border-t border-border/40 bg-muted/25">
      <Container className="space-y-12 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div className="space-y-4">
            <Logo variant="lockup" size="md" href="/" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{tagline}</p>
          </div>

          <FooterColumn title="Product" links={columns.product} />
          <FooterColumn title="Resources" links={columns.resources} />
          <FooterColumn title="Company" links={columns.company} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/30 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {BRAND.name}</p>
          <p>{madeWith}</p>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {LEGAL_LINKS.map((link, index) => (
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

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly { href: string; label: string }[]
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
