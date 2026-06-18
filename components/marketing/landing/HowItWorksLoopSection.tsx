import { ArrowDown, ArrowRight, CheckCircle2, Flag, Globe, MousePointer2 } from 'lucide-react'
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

function LoopStepCard({
  step,
  index,
  visual,
}: {
  step: (typeof LANDING_PAGE.howItWorks.steps)[number]
  index: number
  visual: (typeof STEP_VISUALS)[number]
}) {
  return (
    <div className="flex h-full flex-col rounded-card glass-surface-elevated p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-nested-md shadow-sm',
            visual.iconBg
          )}
        >
          <visual.Icon className={cn('h-5 w-5', visual.iconColor)} aria-hidden />
        </span>
        <span className="font-mono text-3xl font-bold tabular-nums text-muted-foreground/20">
          {String(step.step).padStart(2, '0')}
        </span>
      </div>

      <p className="text-base font-bold">{step.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>

      <div className="mt-5 flex items-center gap-2 rounded-nested-md bg-muted/45 px-3 py-2.5">
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
  )
}

function LoopConnector({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const Icon = direction === 'horizontal' ? ArrowRight : ArrowDown

  return (
    <div
      aria-hidden
      className={cn(
        'shrink-0 items-center justify-center',
        direction === 'horizontal'
          ? 'hidden self-center px-1 xl:flex'
          : 'flex py-1 sm:hidden'
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground/50 shadow-sm backdrop-blur-sm">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
    </div>
  )
}

export function HowItWorksLoopSection() {
  const { label, headline, steps } = LANDING_PAGE.howItWorks

  return (
    <Section spacing="marketing" id="how-it-works" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-8 sm:space-y-11">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="hidden xl:flex xl:items-stretch">
          {steps.flatMap((step, index) => {
            const visual = STEP_VISUALS[index]
            const items = [
              <RevealOnView key={step.title} delayMs={index * 55} className="min-w-0 flex-1">
                <LoopStepCard step={step} index={index} visual={visual} />
              </RevealOnView>,
            ]
            if (index < steps.length - 1) {
              items.push(<LoopConnector key={`connector-${index}`} direction="horizontal" />)
            }
            return items
          })}
        </div>

        <div className="flex flex-col sm:grid sm:grid-cols-2 sm:gap-4 xl:hidden">
          {steps.flatMap((step, index) => {
            const visual = STEP_VISUALS[index]
            const items = [
              <RevealOnView key={step.title} delayMs={index * 55} className="h-full">
                <LoopStepCard step={step} index={index} visual={visual} />
              </RevealOnView>,
            ]
            if (index < steps.length - 1) {
              items.push(<LoopConnector key={`connector-${index}`} direction="vertical" />)
            }
            return items
          })}
        </div>
      </Container>
    </Section>
  )
}
