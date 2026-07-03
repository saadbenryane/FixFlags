import Link from 'next/link'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { BrandIllustration } from '@/components/marketing/landing/BrandIllustration'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

function LoopStepScene({ index }: { index: number }) {
  return (
    <div className="relative mb-5 h-28 overflow-hidden rounded-nested-md border border-border-subtle/65 bg-[radial-gradient(ellipse_78%_92%_at_12%_18%,hsl(var(--brand)/0.13),transparent_58%),linear-gradient(145deg,hsl(var(--background)/0.72),hsl(var(--muted)/0.55))] shadow-glass">
      <div
        aria-hidden
        className="absolute -right-8 -top-10 h-28 w-28 rounded-full border border-border-subtle/60 bg-background/30 backdrop-blur-xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-5 left-5 h-12 w-32 rounded-[50%] bg-foreground/10 blur-xl"
      />

      {index === 0 ? (
        <>
          <div className="absolute left-5 top-5 h-[4.5rem] w-32 rounded-[1.15rem] border border-border-subtle/80 bg-background/55 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-2 w-2 rounded-full bg-success" />
            <span className="absolute left-8 top-4 h-2 w-16 rounded-full bg-foreground/16" />
            <span className="absolute left-4 top-8 h-1.5 w-24 rounded-full bg-foreground/10" />
            <span className="absolute bottom-4 left-4 h-2 w-20 rounded-full bg-brand/35" />
          </div>
          <div className="absolute bottom-5 right-6 h-9 w-20 rounded-full border border-border-subtle/70 bg-background/50 shadow-sm backdrop-blur-xl">
            <span className="absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-success" />
            <span className="absolute left-7 top-1/2 h-1.5 w-10 -translate-y-1/2 rounded-full bg-foreground/16" />
          </div>
        </>
      ) : index === 1 ? (
        <>
          <div className="absolute left-6 top-5 h-16 w-28 rounded-[1.1rem] border border-border-subtle/75 bg-background/55 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold uppercase leading-none text-brand-foreground">
              Flags
            </span>
            <span className="absolute left-4 top-9 h-1.5 w-20 rounded-full bg-foreground/16" />
            <span className="absolute left-4 top-12 h-1.5 w-14 rounded-full bg-foreground/10" />
          </div>
          <div className="absolute bottom-5 right-7 h-10 w-14 rounded-[0.9rem] border border-brand/20 bg-brand/10 shadow-sm">
            <span className="absolute left-1/2 top-2 h-6 w-px -translate-x-1/2 bg-brand" />
            <span className="absolute left-7 top-2 h-4 w-5 rounded-r-full bg-brand" />
          </div>
        </>
      ) : index === 2 ? (
        <>
          <div className="absolute left-5 top-4 h-[4.8rem] w-36 rounded-[1.2rem] border border-border-subtle/75 bg-background/55 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-2 w-20 rounded-full bg-foreground/16" />
            <span className="absolute left-4 top-8 h-1.5 w-28 rounded-full bg-foreground/10" />
            <span className="absolute left-4 top-12 h-1.5 w-24 rounded-full bg-foreground/10" />
            <span className="absolute bottom-3 left-4 h-5 w-16 rounded-full bg-brand/12" />
          </div>
          <div className="absolute bottom-5 right-8 h-9 w-9 rotate-[-14deg] rounded-[0.8rem] border border-border-subtle/70 bg-background/70 shadow-card backdrop-blur-xl">
            <span className="absolute left-3 top-2 h-5 w-3 rotate-[-18deg] [clip-path:polygon(0_0,100%_50%,0_100%,28%_58%)] bg-foreground/80" />
          </div>
        </>
      ) : (
        <>
          <div className="absolute left-6 top-5 h-16 w-28 rounded-[1.1rem] border border-success/20 bg-background/55 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-5 w-5 rounded-full bg-success/14 ring-1 ring-success/35" />
            <span className="absolute left-[1.15rem] top-[1.35rem] h-1.5 w-2.5 rotate-[-42deg] border-b-2 border-l-2 border-success" />
            <span className="absolute left-4 top-11 h-1.5 w-20 rounded-full bg-foreground/13" />
            <span className="absolute left-4 top-14 h-1.5 w-12 rounded-full bg-foreground/10" />
          </div>
          <div className="absolute bottom-5 right-6 h-9 w-24 rounded-full border border-success/20 bg-success/10 shadow-sm">
            <span className="absolute left-4 top-1/2 h-1.5 w-14 -translate-y-1/2 rounded-full bg-success/55" />
          </div>
        </>
      )}
    </div>
  )
}

function LoopStepCard({
  step,
  index,
}: {
  step: (typeof LANDING_PAGE.howItWorks.steps)[number]
  index: number
}) {
  return (
    <div className="flex h-full flex-col rounded-card glass-surface-elevated p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6">
      <div className="relative">
        <LoopStepScene index={index} />
        <span className="absolute right-3 top-3 font-mono text-3xl font-bold tabular-nums text-muted-foreground/24">
          {String(step.step).padStart(2, '0')}
        </span>
      </div>

      <p className="text-base font-bold">{step.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>

      <div className="mt-5 flex items-center gap-2 rounded-nested-md bg-muted/45 px-3 py-2.5">
        {index === 0 && <span className="h-2 w-2 rounded-full bg-success" aria-hidden />}
        {index === 1 && 'previewBadge' in step && step.previewBadge ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-foreground">
            {step.previewBadge}
          </span>
        ) : null}
        {index === 3 && 'previewBadge' in step && step.previewBadge ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
            {step.previewBadge}
          </span>
        ) : null}
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

interface HowItWorksLoopSectionProps {
  sampleHref?: string
}

export function HowItWorksLoopSection({ sampleHref = '/samples' }: HowItWorksLoopSectionProps) {
  const { headline, subhead, sampleLink, steps } = LANDING_PAGE.howItWorks

  return (
    <Section
      spacing="marketing"
      id="how-it-works"
      className="relative overflow-hidden scroll-mt-[var(--header-offset)]"
    >
      <BrandIllustration
        variant="moments"
        sizes="(min-width: 1024px) 560px, 0px"
        className="absolute left-[max(1rem,calc(50%-48rem))] top-2 hidden h-56 w-[34rem] -rotate-1 rounded-card opacity-55 shadow-raised blur-[0.1px] lg:block"
        imageClassName="object-contain"
      />
      <Container className="relative space-y-8 sm:space-y-11">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <LandingSectionHeader headline={headline} />
          <p className="text-base leading-relaxed text-muted-foreground text-pretty">{subhead}</p>
        </div>

        <div className="hidden xl:flex xl:items-stretch">
          {steps.flatMap((step, index) => {
            const items = [
              <RevealOnView key={step.title} delayMs={index * 55} className="min-w-0 flex-1">
                <LoopStepCard step={step} index={index} />
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
            const items = [
              <RevealOnView key={step.title} delayMs={index * 55} className="h-full">
                <LoopStepCard step={step} index={index} />
              </RevealOnView>,
            ]
            if (index < steps.length - 1) {
              items.push(<LoopConnector key={`connector-${index}`} direction="vertical" />)
            }
            return items
          })}
        </div>

        <div className="flex justify-center">
          <Link
            href={sampleHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition-colors hover:text-brand-hover"
          >
            {sampleLink}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </Section>
  )
}
