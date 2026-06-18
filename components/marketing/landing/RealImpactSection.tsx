import { ArrowRight, Check, X } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { cn } from '@/lib/utils'

function CircleScore({
  score,
  tone,
}: {
  score: number
  tone: 'before' | 'after'
}) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/60"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            className={tone === 'after' ? 'text-success' : 'text-brand'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{score}</span>
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
        Score
      </span>
    </div>
  )
}

const BEFORE_ITEMS = [
  'Vague hero, low clarity',
  'Slow mobile load',
  'Missing social preview',
  'Weak CTA',
]

const AFTER_ITEMS = [
  'Clear value in 5 seconds',
  'Faster and smoother',
  'Great social preview',
  'Stronger CTA',
]

export function RealImpactSection() {
  return (
    <Section spacing="marketing" id="real-impact" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-8 sm:space-y-11">
        <LandingSectionHeader
          label="SEE WHAT CHANGED"
          headline="Real impact. Not opinions."
          showLabel
        />
        <p className="mx-auto max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
          Same site, second pass. FixFlags surfaces what changed in clarity, speed, and conversion readiness.
        </p>

        <div className="relative grid gap-4 lg:grid-cols-2 lg:gap-5">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:flex"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-card">
              <ArrowRight className="h-5 w-5" aria-hidden />
            </span>
          </div>

          <article className="rounded-card p-6 glass-surface shadow-card sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-label text-muted-foreground">
                  Before
                </span>
              </div>
              <span className="rounded-full bg-muted/70 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                62 / 100
              </span>
            </div>

            <div className="mb-5 rounded-nested-md bg-muted/35 px-4 py-3.5">
              <p className="text-sm font-semibold text-muted-foreground line-through decoration-destructive/40">
                Build something amazing with AI
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                The all-in-one platform for next-gen teams.
              </p>
            </div>

            <ul className="space-y-2.5">
              {BEFORE_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                    <X className="h-3 w-3 text-destructive" aria-hidden />
                  </span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-5">
              <span className="text-xs font-medium text-muted-foreground">Overall score</span>
              <CircleScore score={62} tone="before" />
            </div>
          </article>

          <article
            className={cn(
              'rounded-card p-6 glass-surface-strong shadow-card sm:p-7',
              'ring-2 ring-success/25',
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-label text-foreground">
                  After
                </span>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-success">
                +30 pts
              </span>
            </div>

            <div className="mb-5 rounded-nested-md bg-brand/5 px-4 py-3.5 ring-1 ring-brand/10">
              <p className="text-sm font-semibold text-foreground">Ship AI products users love.</p>
              <span className="mt-2 inline-flex rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-brand-foreground">
                Start free
              </span>
            </div>

            <ul className="space-y-2.5">
              {AFTER_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10">
                    <Check className="h-3 w-3 text-success" aria-hidden />
                  </span>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-5">
              <span className="text-xs font-medium text-muted-foreground">Overall score</span>
              <CircleScore score={92} tone="after" />
            </div>
          </article>
        </div>
      </Container>
    </Section>
  )
}
