import Link from 'next/link'
import { BRAND } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'

const FOOTER_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs/mcp', label: 'MCP Docs' },
  { href: '/faq', label: 'FAQ' },
]

export function Footer() {
  return (
    <footer className="border-t">
      <Container className="flex items-center justify-between py-6 text-xs text-muted-foreground">
        <span>© 2026 {BRAND.name}</span>
        <div className="flex items-center gap-4">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="link-underline-grow hover:text-foreground transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </Container>
    </footer>
  )
}
