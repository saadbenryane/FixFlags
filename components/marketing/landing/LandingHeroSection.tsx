import Image from 'next/image'
import { ChevronDown, Zap } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { AssuranceRow } from '@/components/marketing/landing/AssuranceRow'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'

/**
 * Launch reference crop. It keeps the hero proof legible at the displayed size
 * and matches the approved glass-card composition.
 */
const HERO_GLASS = {
  src: '/marketing/visuals/home-hero-master-v3.png',
  width: 1286,
  height: 1223,
} as const

export function LandingHeroSection() {
  return (
    <Section
      spacing="hero"
      className="relative flex min-h-0 flex-col overflow-x-clip"
    >
      <Container
        variant="marketing"
        className="flex w-full flex-col px-4 sm:px-6 lg:px-12"
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-center lg:gap-x-5 xl:grid-cols-[minmax(0,31rem)_minmax(0,1fr)] xl:gap-x-6">
          <div className="order-1 flex max-w-xl flex-col gap-4 sm:gap-5 lg:max-w-none lg:pt-1">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-brand sm:text-xs">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                aria-hidden
              />
              {HERO.badge}
            </p>

            <div className="space-y-5 sm:space-y-6 lg:mt-2.5 lg:space-y-4">
              <Heading
                as="h1"
                className="max-w-[14ch] text-[2.75rem] font-bold leading-[1.08] tracking-display [text-rendering:geometricPrecision] sm:text-[3.125rem] sm:leading-[1.08] lg:text-[4rem] lg:leading-none xl:text-[4.125rem]"
              >
                {HERO.headlineDisplay}
                {HERO.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </Heading>
              <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground/95 text-pretty sm:max-w-xl sm:text-base lg:max-w-[34rem] lg:text-base lg:leading-relaxed">
                {HERO.subhead}
              </p>
            </div>

            <div
              id="audit"
              className="w-full scroll-mt-[calc(var(--header-offset)+1rem)] pt-1"
            >
              <AuditInput
                variant="landing"
                idSuffix="-hero"
                ctaPlacement="hero"
                showLandingExtras={false}
              />
            </div>

            <AssuranceRow />

            {/* Product-true trust band, no invented counts or avatars */}
            <div className="flex items-center gap-3 pt-1">
              <p className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <Zap
                  className="h-4 w-4 shrink-0 text-brand"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="font-medium leading-none">
                  {HERO.trustLine}
                </span>
              </p>
            </div>

            <EditorToolMarks
              variant="hero"
              showLabel
              className="mt-1 lg:mt-8"
            />
          </div>

          <div className="order-2 relative mx-auto flex w-full max-w-[28rem] justify-center sm:max-w-[32rem] lg:mx-0 lg:block lg:h-[32rem] lg:max-w-none lg:justify-self-stretch">
            <div
              className="relative w-full lg:absolute lg:-right-9 lg:-top-[4.5rem] lg:w-[37.5rem] lg:max-w-none"
              style={{
                aspectRatio: `${HERO_GLASS.width} / ${HERO_GLASS.height}`,
              }}
            >
              <Image
                src={HERO_GLASS.src}
                alt="FixFlags reviewing a live product across Message, Experience, and Reach, then preparing fixes for Re-check."
                width={HERO_GLASS.width}
                height={HERO_GLASS.height}
                priority
                sizes="(min-width: 1024px) 37.5rem, (min-width: 640px) 32rem, 28rem"
                className="h-full w-full select-none object-contain object-center drop-shadow-[0_28px_56px_hsl(240_8%_5%/0.12)] dark:drop-shadow-[0_28px_56px_rgb(0_0_0/0.4)] lg:object-right"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <a
          href="#sample-review"
          className="mx-auto mt-8 flex min-h-11 w-fit flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground/80 sm:mt-10 lg:mt-8"
        >
          {HERO.scrollHint}
          <ChevronDown
            className="h-3.5 w-3.5 animate-bounce motion-reduce:animate-none"
            aria-hidden
          />
        </a>
      </Container>
    </Section>
  )
}
