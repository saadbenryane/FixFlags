'use client'

import Link from 'next/link'
import { Github, Linkedin } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { NavLink } from '@/components/layout/nav-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Input } from '@/components/ui/input'
import { BRAND, LANDING_PAGE } from '@/lib/marketing/copy'
import { LEGAL_LINKS } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_FOOTER_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'
import { toast } from 'sonner'

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {children}
    </a>
  )
}

export function Footer() {
  const { tagline, newsletter, madeWith, columns } = LANDING_PAGE.footer

  function handleSubscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    toast.message('Thanks. Product updates are coming soon.')
  }

  return (
    <footer className="border-t border-border/40 bg-muted/25">
      <Container className="space-y-12 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_1.1fr] lg:gap-8">
          <div className="space-y-4">
            <Logo variant="lockup" size="md" href="/" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{tagline}</p>
            <div className="flex items-center gap-1">
              <SocialLink href="https://x.com" label="FixFlags on X">
                <span className="font-sans text-sm font-bold">X</span>
              </SocialLink>
              <SocialLink href="https://linkedin.com" label="FixFlags on LinkedIn">
                <Linkedin className="h-4 w-4" />
              </SocialLink>
              <SocialLink href="https://github.com" label="FixFlags on GitHub">
                <Github className="h-4 w-4" />
              </SocialLink>
            </div>
          </div>

          <FooterColumn title="Product" links={columns.product} />
          <FooterColumn title="Resources" links={columns.resources} />
          <FooterColumn title="Company" links={columns.company} />

          <div className="space-y-3">
            <p className="text-sm font-semibold">{newsletter.title}</p>
            <form onSubmit={handleSubscribe} className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                name="email"
                placeholder={newsletter.placeholder}
                autoComplete="email"
                className="h-10 bg-background"
              />
              <Button type="submit" variant="outline" className="shrink-0">
                {newsletter.cta}
              </Button>
            </form>
          </div>
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
          <li key={link.href}>
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
