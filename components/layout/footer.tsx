import type { Route } from 'next'
import { PublicLink } from '@/components/marketing/public-site/PublicInteraction'
import { Logo } from '@/components/brand/Logo'
import { FooterBottom } from '@/components/layout/FooterBottom'
import { Container } from '@/components/ui/container'
import { BRAND } from '@/lib/marketing/copy/brand'
import { FOOTER_COLUMN_COPY } from '@/lib/marketing/copy/navigation'
import { FOOTER_COLUMNS } from '@/lib/site/nav'

export function Footer() {
  return (
    <footer className="bg-background">
      <Container
        variant="marketing"
        className="px-5 pb-7 pt-12 sm:px-6 sm:pb-8 sm:pt-16 lg:px-12 lg:pb-9 lg:pt-20"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.35fr_repeat(4,minmax(0,0.9fr))] lg:gap-x-7 xl:gap-x-10">
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <Logo variant="lockup" size="lg" href="/" />
            <p className="max-w-[18rem] text-sm leading-[1.65] text-muted-foreground text-pretty">
              {BRAND.footerDescription}
            </p>
          </div>

          <FooterColumn title={FOOTER_COLUMN_COPY.product} links={FOOTER_COLUMNS.product} />
          <FooterColumn
            title={FOOTER_COLUMN_COPY.resources}
            links={FOOTER_COLUMNS.resources}
          />
          <FooterColumn title={FOOTER_COLUMN_COPY.company} links={FOOTER_COLUMNS.company} />
          <FooterColumn title={FOOTER_COLUMN_COPY.trust} links={FOOTER_COLUMNS.trust} />

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
      <p className="mb-3 font-sans text-sm font-semibold tracking-normal text-foreground/85 [overflow-wrap:anywhere]">
        {title}
      </p>
      <ul className="min-w-0">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <PublicLink
              target={link.label}
              href={link.href as Route}
              className="inline-flex min-h-11 min-w-11 max-w-full items-center text-xs leading-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {link.label}
              </span>
            </PublicLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
