import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  Wrench,
} from 'lucide-react'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function WhyBuildersChooseSection() {
  const copy = LANDING_PAGE.whyBuildersChoose
  const demo = copy.demo
  const [headlineLead, headlineTail = ''] = copy.headlineDisplay.split('. ')

  return (
    <Section
      spacing="marketing"
      id="why-fixflags"
      className="scroll-mt-[var(--header-offset)]"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <div className="grid items-end gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                {copy.label}
              </p>
              <h2 className="mt-4 max-w-[13ch] font-display text-[2.2rem] font-bold leading-[1.02] tracking-display text-foreground sm:text-[2.75rem] lg:text-[3rem]">
                {headlineLead}. {headlineTail}
                <span className="text-brand" aria-hidden>
                  .
                </span>
              </h2>
            </div>
            <p className="max-w-[38rem] text-[0.9375rem] leading-relaxed text-muted-foreground lg:pb-1 lg:text-base">
              {copy.subhead}
            </p>
          </div>
        </RevealOnView>

        <RevealOnView>
          <div className="mt-9 overflow-hidden rounded-[1.25rem] border border-border/50 bg-background shadow-glass-hero">
            <div className="flex min-h-14 items-center justify-between border-b border-border/45 px-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {demo.title}
                </p>
                <p className="font-mono text-[0.625rem] text-muted-foreground">
                  {demo.path}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {demo.status}
              </span>
            </div>

            <div className="grid lg:grid-cols-[0.68fr_1.32fr]">
              <div className="border-b border-border/45 bg-muted/15 p-3 lg:border-b-0 lg:border-r">
                <p className="px-2 py-2 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {demo.listLabel}
                </p>
                <ul className="space-y-1">
                  {demo.flags.map((flag, index) => (
                    <li key={flag.title}>
                      <div
                        className={
                          index === 0
                            ? 'flex items-center gap-3 rounded-[0.7rem] bg-background px-3 py-3 shadow-sm ring-1 ring-border/45'
                            : 'flex items-center gap-3 rounded-[0.7rem] px-3 py-3'
                        }
                      >
                        <AlertTriangle
                          className={
                            index === 0
                              ? 'h-4 w-4 shrink-0 text-destructive'
                              : 'h-4 w-4 shrink-0 text-muted-foreground/55'
                          }
                          strokeWidth={1.8}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {flag.title}
                          </p>
                          <p className="mt-0.5 text-[0.625rem] text-muted-foreground">
                            {flag.meta}
                          </p>
                        </div>
                        {index === 0 ? (
                          <ChevronRight
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-destructive">
                      {demo.severity}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-heading text-foreground sm:text-2xl">
                      {demo.flagTitle}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-[0.55rem] bg-muted/35 px-2.5 py-1.5 text-[0.6875rem] font-medium text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    {demo.evidenceStatus}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                  <section className="rounded-[0.8rem] bg-muted/20 p-4 ring-1 ring-border/45">
                    <p className="text-xs font-semibold text-foreground">
                      {demo.whyTitle}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {demo.whyBody}
                    </p>
                    <div className="mt-4 rounded-[0.65rem] bg-background p-3 shadow-sm ring-1 ring-border/45">
                      <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
                      <div className="mt-2 h-2 w-5/6 rounded-full bg-foreground/8" />
                      <div className="mt-8 h-9 rounded-[0.45rem] border border-dashed border-brand/55 bg-brand/5" />
                      <p className="mt-2 text-center font-mono text-[0.5625rem] text-brand">
                        {demo.viewportLabel}
                      </p>
                    </div>
                  </section>

                  <section className="flex flex-col rounded-[0.8rem] bg-foreground p-4 text-background">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold">
                        <Wrench className="h-3.5 w-3.5 text-brand" aria-hidden />
                        {demo.promptTitle}
                      </span>
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-[0.6875rem] font-medium text-background/70 transition-colors duration-150 hover:bg-background/10 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {demo.copyAction}
                      </button>
                    </div>
                    <p className="mt-5 flex-1 font-mono text-[0.6875rem] leading-[1.8] text-background/75">
                      {demo.prompt}
                    </p>
                    <div className="mt-5 flex items-center gap-2 border-t border-background/15 pt-3 text-[0.6875rem] text-background/70">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                      {demo.recheckLabel}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
