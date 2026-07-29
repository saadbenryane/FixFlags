import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function IntegrationsBlock() {
  const copy = LANDING_PAGE.integrationsBlock

  return (
    <Section spacing="compact" tint="subtle" className="py-8 sm:py-10 lg:py-10">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-[48rem] text-center">
          <p className="inline-flex items-center justify-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            {copy.label}
          </p>
          <h2 className="mt-4 text-balance font-display text-[1.75rem] font-bold leading-[1.08] tracking-display text-foreground sm:text-[2rem] lg:text-[2.25rem]">
            {copy.headlineDisplay}
            {copy.headlineAccentPeriod ? (
              <span className="text-brand" aria-hidden>.</span>
            ) : null}
          </h2>
          <p className="mx-auto mt-3 max-w-[36rem] text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            {copy.body}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-[42rem]">
          <EditorToolMarks
            variant="hero"
            showLabel
            className="justify-center"
          />
        </div>

        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={copy.mcpHref}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {copy.mcpCta}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href={copy.cliHref}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border/50 bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {copy.cliCta}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </Container>
    </Section>
  )
}
