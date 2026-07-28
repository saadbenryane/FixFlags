import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { HowItWorksSampleLink } from '@/components/marketing/landing/SampleFunnelEvents'
import { LANDING_PAGE } from '@/lib/marketing/copy'

type LoopStep = (typeof LANDING_PAGE.howItWorks.steps)[number]

const STEP_VISUALS = {
  start: {
    src: '/marketing/visuals/how-it-works-url-v3.webp',
    alt: 'A generated FixFlags glass tile showing a live URL field and Review my site action.',
  },
  review: {
    src: '/marketing/visuals/how-it-works-review-v3.webp',
    alt: 'A generated FixFlags glass tile reviewing Message, Experience, and Reach.',
  },
  recheck: {
    src: '/marketing/visuals/how-it-works-findings-v3.webp',
    alt: 'A generated FixFlags glass tile showing prioritized Flags, a fix action, and Re-check.',
  },
} as const

function StepVisual({ visual }: { visual: LoopStep['visual'] }) {
  const artwork = STEP_VISUALS[visual]
  return (
    <div className="relative mx-auto mt-4 w-full max-w-[16rem] sm:mt-5">
      <Image
        src={artwork.src}
        alt={artwork.alt}
        width={1254}
        height={1254}
        sizes="(min-width: 1024px) 256px, (min-width: 768px) 30vw, 256px"
        priority
        unoptimized
        className="h-auto w-full select-none object-contain drop-shadow-[0_18px_28px_hsl(240_8%_5%/0.1)]"
        draggable={false}
      />
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
