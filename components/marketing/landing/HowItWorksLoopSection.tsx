import { ArrowRight, CheckCircle2, Flag, Globe, MousePointer2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
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

        <div className="relative">
          <div
            aria-hidden
            className="absolute left-6 top-0 hidden h-full w-px bg-border/60 sm:block xl:left-0 xl:top-9 xl:h-px xl:w-full"
          />
          <div
            aria-hidden
            className="absolute left-0 top-9 hidden h-px w-full origin-left bg-brand/70 motion-safe:animate-loop-progress motion-reduce:hidden xl:block"
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {steps.map((step, index) => {
              const visual = STEP_VISUALS[index]
              return (
                <RevealOnView key={step.title} delayMs={index * 55} className="h-full">
                  <div className="relative h-full">
                    <div className="flex h-full flex-col rounded-card bg-card p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <span className={cn('relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-sm', visual.iconBg)}>
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

                      <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2.5">
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

                    {index < steps.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute -right-3 top-9 hidden h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground/40 shadow-sm xl:flex"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </RevealOnView>
              )
            })}
          </div>
        </div>
      </Container>
    </Section>
  )
}
