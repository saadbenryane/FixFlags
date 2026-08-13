import type { Route } from 'next'
import Link from 'next/link'
import { Clock3, LockKeyhole, RefreshCcw, ShieldCheck } from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import { Logo } from '@/components/brand/Logo'
import { FooterNewsletter } from '@/components/layout/FooterNewsletter'
import { FooterThemeToggle } from '@/components/layout/FooterThemeToggle'
import { Container } from '@/components/ui/container'
import { BRAND, LANDING_PAGE } from '@/lib/marketing/copy'
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site/nav'
import { HOMEPAGE_EDITOR_INTEGRATIONS, editorDocsHref } from '@/lib/integrations/editor-catalog'

const FOOTER_EDITOR_MARKS = HOMEPAGE_EDITOR_INTEGRATIONS

const METRIC_ICONS = {
  speed: Clock3,
  recheck: RefreshCcw,
  private: LockKeyhole,
  teaser: ShieldCheck,
} as const

export function Footer() {
  const { tagline, madeWith, buildersTitle, buildersBody, buildersCta, buildersHref } = LANDING_PAGE.footer
  const trustMetrics = LANDING_PAGE.sampleReport.trustMetrics

  return (
    <footer className="border-t border-border/45 bg-background">
      <Container variant="marketing" className="px-5 pb-7 pt-10 sm:px-6 sm:pb-8 sm:pt-12 lg:px-12 lg:pb-9 lg:pt-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.35fr_repeat(4,minmax(0,0.78fr))_1.28fr] lg:gap-x-7 xl:gap-x-10">
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <Logo variant="lockup" size="lg" href="/" />
            <p className="max-w-[15rem] text-xs leading-[1.65] text-muted-foreground text-pretty">{tagline}</p>
          </div>

          <FooterColumn title="Product" links={FOOTER_COLUMNS.product} />
          <FooterColumn title="Resources" links={FOOTER_COLUMNS.resources.slice(0, 5)} />
          <FooterColumn title="Company" links={FOOTER_COLUMNS.company} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />

          <div className="col-span-2 space-y-3 lg:col-span-1">
            <p className="font-mono text-3xs font-semibold uppercase tracking-label text-foreground/85">
              {buildersTitle}
            </p>
            <p className="max-w-[16rem] text-xs leading-[1.6] text-muted-foreground text-pretty">{buildersBody}</p>
            <ul className="grid max-w-[17rem] grid-cols-2 gap-2" aria-label="Supported AI builders">
              {FOOTER_EDITOR_MARKS.map((editor) => (
                <li key={editor.key}>
                  <Link
                    href={editorDocsHref(editor)}
                    className="flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-border/65 bg-background px-2.5 text-3xs font-semibold text-foreground/80 shadow-sm transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <EditorMark
                      name={editor.label}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
                    />
                    <span className="truncate">{editor.label === 'Claude Code' ? 'Claude' : editor.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={buildersHref as Route}
              className="inline-flex min-h-11 items-center text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {buildersCta} <span aria-hidden>&nbsp;→</span>
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-7 border-t border-border/55 pt-7 lg:mt-8 lg:grid-cols-[1.28fr_repeat(4,minmax(0,1fr))_1.55fr] lg:gap-0 lg:pt-8">
          <div className="col-span-2 space-y-2 lg:col-span-1 lg:pr-7">
            <p className="text-2xs leading-relaxed text-muted-foreground">
              © {new Date().getFullYear()} {BRAND.name}
            </p>
            <p className="text-2xs leading-relaxed text-muted-foreground">{madeWith}</p>
            <FooterThemeToggle />
          </div>

          {trustMetrics.map((metric) => (
            <FooterMetric key={metric.id} id={metric.id} value={metric.value} label={metric.label} />
          ))}

          <FooterNewsletter className="col-span-2 lg:col-span-1 lg:pl-7" />
        </div>
      </Container>
    </footer>
  )
}

function FooterMetric({ id, value, label }: { id: keyof typeof METRIC_ICONS; value: string; label: string }) {
  const Icon = METRIC_ICONS[id]

  return (
    <div className="space-y-2 border-border/55 lg:border-l lg:px-6">
      <Icon className="h-5 w-5 text-brand" strokeWidth={1.75} aria-hidden />
      <p className="text-sm font-semibold tracking-heading text-foreground">{value}</p>
      <p className="max-w-[9.5rem] text-3xs leading-[1.55] text-muted-foreground">{label}</p>
    </div>
  )
}

function FooterColumn({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-3 font-mono text-3xs font-semibold uppercase tracking-label text-foreground/85">
        {title}
      </p>
      <ul>
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href as Route}
              className="inline-flex min-h-11 min-w-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
