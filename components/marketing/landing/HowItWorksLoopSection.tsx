import { ArrowRight, CheckCircle2, Flag, Globe, MousePointer2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const STEP_VISUALS = [
  { Icon: Globe, iconBg: 'bg-muted', iconColor: 'text-muted-foreground' },
  { Icon: Flag, iconBg: 'bg-brand/10', iconColor: 'text-brand' },
  { Icon: MousePointer2, iconBg: 'bg-muted', iconColor: 'text-foreground' },
  { Icon: CheckCircle2, iconBg: 'bg-success/10', iconColor: 'text-success' },
] as const

export function HowItWorksLoopSection() {
  const { label, headline, steps } = LANDING_PAGE.howItWorks

  return (
    <Section
      spacing="marketing"
      id="how-it-works"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-12 sm:space-y-16">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {steps.map((step, index) => {
            const visual = STEP_VISUALS[index]
            return (
            <div key={step.title} className="relative">
              <div className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-5 shadow-md transition-shadow hover:shadow-lg sm:p-6">
                {/* icon + number */}
                <div className="mb-4 flex items-center justify-between">
                  <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl', visual.iconBg)}>
                    <visual.Icon className={cn('h-5 w-5', visual.iconColor)} aria-hidden />
                  </span>
                  <span className="font-mono text-3xl font-bold tabular-nums text-muted-foreground/20">
                    {String(step.step).padStart(2, '0')}
                  </span>
                </div>

                <p className="text-base font-bold">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {step.body}
                </p>

                {/* preview chip */}
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
                  {index === 0 && <span className="h-2 w-2 rounded-full bg-success" aria-hidden />}
                  {index === 1 && (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-foreground">
                      7
                    </span>
                  )}
                  {index === 2 && <MousePointer2 className="h-3 w-3 text-muted-foreground" aria-hidden />}
                  {index === 3 && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
                      +32%
                    </span>
                  )}
                  <span className="font-mono text-xs text-foreground/80">{step.preview}</span>
                </div>
              </div>

              {/* connector arrow */}
              {index < steps.length - 1 && (
                <ArrowRight
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/30 xl:block"
                />
              )}
            </div>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
