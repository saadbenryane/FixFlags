import Link from 'next/link'
import { BRAND } from '@/lib/marketing/copy'
import { FOOTER_LINKS } from '@/lib/site/nav'
import { Container } from '@/components/ui/container'

export function Footer() {
  return (
    <footer className="border-t">
      <Container className="flex flex-col gap-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
      </Container>
    </footer>
  )
}
