import Image from 'next/image'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Link2,
  RefreshCw,
} from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { HowItWorksSampleLink } from '@/components/marketing/landing/SampleFunnelEvents'
import { rubricIcon } from '@/lib/rubric-icons'
import { LANDING_PAGE } from '@/lib/marketing/copy'

type LoopStep = (typeof LANDING_PAGE.howItWorks.steps)[number]

const GLASS_PLATE = {
  src: '/marketing/visuals/how-it-works-glass-plate-v2.webp',
  width: 1254,
  height: 1254,
} as const

const REVIEW_ROWS = [
  { label: 'Message', icon: 'message' as const },
  { label: 'Experience', icon: 'experience' as const },
  { label: 'Reach', icon: 'reach' as const },
] as const

function StartVisual() {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[0.6875rem] font-semibold text-foreground sm:text-xs">
        Paste your live URL
      </p>
      <div className="mt-3 flex min-h-10 items-center gap-2 rounded-[0.55rem] border border-border/60 bg-background/75 px-3 text-[0.625rem] text-muted-foreground shadow-sm sm:text-[0.6875rem]">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-foreground/55" aria-hidden />
        yourproduct.com
      </div>
      <div className="mt-2.5 flex min-h-10 items-center justify-center gap-1.5 rounded-[0.55rem] bg-brand px-3 text-[0.6875rem] font-semibold text-white shadow-button">
        Review my site
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </div>
    </div>
  )
}

function ReviewVisual() {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[0.6875rem] font-semibold text-foreground sm:text-xs">
          Reviewing the live product
        </p>
        <span className="inline-flex items-center gap-1 text-[0.5625rem] font-medium text-success">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Live
        </span>
      </div>
      <ul className="space-y-2">
        {REVIEW_ROWS.map((row) => {
          const Icon = rubricIcon(row.icon)
          return (
            <li
              key={row.label}
              className="flex min-h-9 items-center gap-2.5 rounded-[0.55rem] border border-border/50 bg-background/70 px-3 shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.8} aria-hidden />
              <span className="text-[0.625rem] font-semibold text-foreground sm:text-[0.6875rem]">
                {row.label}
              </span>
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-success" aria-hidden />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RecheckVisual() {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[0.6875rem] font-semibold text-foreground sm:text-xs">
        Highest-impact Flags
      </p>
      <ul className="mt-2.5 space-y-2">
        {[
          ['Hidden mobile CTA', 'Experience'],
          ['Hero value is unclear', 'Message'],
        ].map(([title, rubric]) => (
          <li
            key={title}
            className="flex items-center gap-2 rounded-[0.55rem] border border-border/50 bg-background/70 px-2.5 py-2 shadow-sm"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.625rem] font-semibold text-foreground sm:text-[0.6875rem]">
                {title}
              </span>
              <span className="block text-[0.5625rem] text-muted-foreground">{rubric}</span>
            </span>
            <Copy className="h-3.5 w-3.5 text-foreground/45" aria-hidden />
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex min-h-9 items-center justify-center gap-1.5 rounded-[0.55rem] bg-foreground text-[0.625rem] font-semibold text-background sm:text-[0.6875rem]">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Copy fix. Re-check.
      </div>
    </div>
  )
}

function StepVisual({ visual }: { visual: LoopStep['visual'] }) {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-[16rem] sm:mt-5">
      <Image
        src={GLASS_PLATE.src}
        alt=""
        width={GLASS_PLATE.width}
        height={GLASS_PLATE.height}
        sizes="(min-width: 1024px) 256px, (min-width: 768px) 30vw, 256px"
        loading="lazy"
        className="h-auto w-full select-none object-contain drop-shadow-[0_18px_28px_hsl(240_8%_5%/0.1)]"
        draggable={false}
      />
      <div className="absolute inset-x-[17%] bottom-[19%] top-[17%]">
        {visual === 'start' ? <StartVisual /> : null}
        {visual === 'review' ? <ReviewVisual /> : null}
        {visual === 'recheck' ? <RecheckVisual /> : null}
      </div>
    </div>
  )
}

function StepCard({ step }: { step: LoopStep }) {
  return (
    <article className="flex min-w-0 flex-col">
      <p className="font-mono text-xs font-semibold tabular-nums text-brand">
        {String(step.step).padStart(2, '0')}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-heading text-foreground">
        {step.title}
      </h3>
      <p className="mt-1.5 min-h-11 text-[0.8125rem] leading-relaxed text-muted-foreground text-pretty sm:text-sm">
        {step.body}
      </p>
      <StepVisual visual={step.visual} />
    </article>
  )
}

interface HowItWorksLoopSectionProps {
  sampleHref?: string
}

export function HowItWorksLoopSection({
  sampleHref = '/samples',
}: HowItWorksLoopSectionProps) {
  const {
    label,
    headlineDisplay,
    headlineAccentPeriod,
    subhead,
    sampleLink,
    steps,
  } = LANDING_PAGE.howItWorks

  return (
    <Section
      spacing="tight"
      id="how-it-works"
      className="relative scroll-mt-[var(--header-offset)] overflow-hidden"
    >
      <Container
        variant="marketing"
        className="relative space-y-7 px-4 sm:space-y-9 sm:px-6 lg:space-y-10 lg:px-12"
      >
        <LandingSectionHeader
          label={label}
          brandEyebrow
          headline={headlineDisplay}
          accentPeriod={headlineAccentPeriod}
          subhead={subhead}
        />

        <RevealOnView>
          <div className="grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-8">
            {steps.map((step, index) => (
              <div key={step.title} className="relative min-w-0">
                <StepCard step={step} />
                {index < steps.length - 1 ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-[58%] hidden -translate-y-1/2 md:block lg:-right-4"
                  >
                    <ArrowRight
                      className="h-5 w-5 text-foreground/55"
                      strokeWidth={1.5}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </RevealOnView>

        <div className="flex justify-center">
          <HowItWorksSampleLink href={sampleHref} label={sampleLink} />
        </div>
      </Container>
    </Section>
  )
}
