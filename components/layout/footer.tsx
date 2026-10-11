import type { Route } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { FooterBottom } from '@/components/layout/FooterBottom'
import { Container } from '@/components/ui/container'
import { BRAND } from '@/lib/marketing/copy'
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site/nav'

export function Footer() {
  return (
    <footer className="bg-background">
      <Container
        variant="marketing"
        className="px-5 pb-7 pt-10 sm:px-6 sm:pb-8 sm:pt-12 lg:px-12 lg:pb-9 lg:pt-8"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.35fr_repeat(4,minmax(0,0.9fr))] lg:gap-x-7 xl:gap-x-10">
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <Logo variant="lockup" size="lg" href="/" />
            <p className="max-w-[18rem] text-sm leading-[1.65] text-muted-foreground text-pretty">
              {BRAND.footerDescription}
            </p>
          </div>

          <FooterColumn title="Product" links={FOOTER_COLUMNS.product} />
          <FooterColumn
            title="Resources"
            links={FOOTER_COLUMNS.resources.slice(0, 5)}
          />
          <FooterColumn title="Company" links={FOOTER_COLUMNS.company} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />

        </div>

        <FooterBottom year={new Date().getFullYear()} brandName={BRAND.name} category={BRAND.category} />
        <p className="mx-auto mt-5 max-w-3xl text-center text-2xs leading-relaxed text-muted-foreground">
          {BRAND.trademarkNotice}
        </p>
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
    <div className="min-w-0">
      <p className="mb-3 font-sans text-sm font-semibold tracking-normal text-foreground/85">
        {title}
      </p>
      <ul className="min-w-0">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href as Route}
              className="inline-flex min-h-11 min-w-11 max-w-full items-center text-xs leading-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {link.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
