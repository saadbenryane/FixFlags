import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Copy,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function IntegrationsBlock() {
  const copy = LANDING_PAGE.integrationsBlock
  const workflow = LANDING_PAGE.editorIntegrations.workspace
  const stateIcons = [CircleDot, Wrench, RefreshCw]

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] overflow-hidden py-16 sm:py-20 lg:py-24"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-14 xl:gap-20">
          <RevealOnView>
            <div className="max-w-lg">
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
              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
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

          <RevealOnView>
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-10 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.08),transparent_66%)]"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-card bg-background shadow-glass-hero ring-1 ring-border/55">
                <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border/45 px-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <EditorMark
                      name="Cursor"
                      className="h-4 w-4 shrink-0 text-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {workflow.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-3xs text-muted-foreground">
                        {workflow.meta}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-success">
                    <CircleDot className="h-3.5 w-3.5" aria-hidden />
                    {workflow.status}
                  </span>
                </header>

                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 rounded-[var(--radius-inner)] bg-muted/25 px-4 py-3.5">
                    <span className="font-mono text-2xs font-semibold uppercase tracking-label text-muted-foreground">
                      {workflow.userLabel}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground">
                      {workflow.request}
                    </p>
                  </div>

                  <div className="relative mt-6 grid gap-3 md:grid-cols-3">
                    <div
                      className="absolute left-[16.666%] right-[16.666%] top-5 hidden h-px bg-border/65 md:block"
                      aria-hidden
                    />
                    {workflow.states.map((state, index) => {
                      const Icon = stateIcons[index] ?? CircleDot
                      const verified = state.id === 'recheck'
                      return (
                        <div
                          key={state.id}
                          className="relative rounded-[var(--radius-inner)] bg-background px-3 py-4 ring-1 ring-border/45"
                        >
                          <span
                            className={cn(
                              'relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background ring-1 ring-border/65',
                              verified ? 'text-success' : 'text-brand'
                            )}
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                          </span>
                          <p className="mt-4 font-mono text-3xs font-semibold uppercase tracking-label text-muted-foreground">
                            {state.label}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {state.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {state.body}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-inner)] bg-foreground px-4 py-3.5 text-background sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {workflow.verifiedTitle}
                        </p>
                        <p className="mt-0.5 truncate text-2xs text-background/65">
                          {workflow.verifiedBody}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-2xs font-medium text-background/75">
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {workflow.continueLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnView>
        </div>
      </Container>
    </Section>
  )
}
