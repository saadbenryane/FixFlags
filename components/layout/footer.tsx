import Link from 'next/link'
import { AuditInput } from '@/components/audit/AuditInput'
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="link-underline-grow transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  )
}
