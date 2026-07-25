import type { Route } from 'next'
import Link from 'next/link'
import { Instagram } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { FooterNewsletter } from '@/components/layout/FooterNewsletter'
import { FooterThemeToggle } from '@/components/layout/FooterThemeToggle'
import { NavLink } from '@/components/layout/nav-link'
import { Container } from '@/components/ui/container'
import { BRAND, LANDING_PAGE } from '@/lib/marketing/copy'
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_FOOTER_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'

export function Footer() {
  const { tagline, madeWith, buildersTitle, buildersBody, buildersCta, buildersHref, social } =
    LANDING_PAGE.footer

  return (
    <footer className="glass-surface border-0">
      <Container className="space-y-8 py-10 sm:space-y-11 sm:py-11 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_1.4fr] lg:gap-8">
          <div className="space-y-5">
            <Logo variant="lockup" size="md" href="/" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{tagline}</p>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {buildersTitle}
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
                {buildersBody}
              </p>
              <EditorToolMarks
                compact
                showLabel={false}
                className="[&_ul]:gap-2 [&_li]:rounded-[var(--radius-control)] [&_li]:border [&_li]:border-border/50 [&_li]:px-2.5 [&_li]:py-1.5 [&_li]:text-xs [&_li]:font-medium [&_svg]:h-3.5 [&_svg]:w-3.5"
              />
              <Link
                href={buildersHref as Route}
                className="inline-flex min-h-10 items-center text-sm font-semibold text-brand hover:text-brand-hover"
              >
                {buildersCta}
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {social.instagram ? (
                <FooterSocialLink href={social.instagram} label="Instagram">
                  <Instagram className="h-4 w-4" aria-hidden />
                </FooterSocialLink>
              ) : null}
            </div>
          </div>

          <FooterColumn title="Product" links={FOOTER_COLUMNS.product} />
          <FooterColumn title="Resources" links={FOOTER_COLUMNS.resources} />
          <FooterColumn title="Company" links={FOOTER_COLUMNS.company} />
          <FooterNewsletter />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/30 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.name}
          </p>
          <p>{madeWith}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FooterThemeToggle />
            <span className="mx-1 select-none text-muted-foreground/50" aria-hidden>
              ·
            </span>
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

function FooterSocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href as Route}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label}
    >
      {children}
    </Link>
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
              href={link.href as Route}
              className="inline-flex min-h-11 min-w-11 items-center py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
