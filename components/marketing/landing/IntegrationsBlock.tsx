import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function IntegrationsBlock() {
  const copy = LANDING_PAGE.integrationsBlock

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] overflow-hidden py-16 sm:py-20 lg:py-24"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {copy.label}
            </p>
            <h2 className="mt-4 text-balance font-display text-[2rem] font-bold leading-[1.04] tracking-display text-foreground sm:text-[2.5rem] lg:text-[3rem]">
              {copy.headlineDisplay}
              {copy.headlineAccentPeriod ? (
                <span className="text-brand" aria-hidden>.</span>
              ) : null}
            </h2>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
              {copy.body}
            </p>

            <div className="mt-7">
              <EditorToolMarks
                variant="hero"
                showLabel={false}
                className="justify-start"
              />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={copy.mcpHref}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] bg-brand px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {copy.mcpCta}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
              <Link
                href={copy.cliHref}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {copy.cliCta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
