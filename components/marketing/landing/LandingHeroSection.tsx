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
  src: '/marketing/visuals/home-hero-master-v2.webp',
  width: 1600,
  height: 1507,
} as const

const HERO_STATES = [
  ['Reviewing', 'Live product'],
  ['7 Flags', 'Issues ranked'],
  ['Fixing', 'Prompts ready'],
  ['Ready to ship', 'Re-check passed'],
] as const

const HERO_RUBRICS = [
  ['Message', 'Clear and specific'],
  ['Experience', 'Easy to complete'],
  ['Reach', 'Ready to find'],
] as const

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
                alt=""
                width={HERO_GLASS.width}
                height={HERO_GLASS.height}
                priority
                sizes="(min-width: 1024px) 37.5rem, (min-width: 640px) 32rem, 28rem"
                className="h-full w-full select-none object-contain object-center drop-shadow-[0_28px_56px_hsl(240_8%_5%/0.12)] dark:drop-shadow-[0_28px_56px_rgb(0_0_0/0.4)] lg:object-right"
                draggable={false}
              />
              <div
                className="pointer-events-none absolute inset-0 select-none text-[0.48rem] leading-tight text-foreground sm:text-[0.58rem]"
                aria-hidden
              >
                <div className="absolute left-[18%] top-[22%] w-[37%] space-y-[6%] sm:space-y-3">
                  {HERO_STATES.map(([title, detail], index) => (
                    <div
                      key={title}
                      className="grid grid-cols-[0.65rem_1fr] items-center gap-1.5 sm:grid-cols-[0.8rem_1fr] sm:gap-2"
                    >
                      <span
                        className={
                          index === 1
                            ? 'h-2.5 w-2.5 rounded-[0.2rem] bg-brand sm:h-3 sm:w-3'
                            : index === HERO_STATES.length - 1
                              ? 'h-2.5 w-2.5 rounded-full border border-success/70 bg-success/10 sm:h-3 sm:w-3'
                              : 'h-2.5 w-2.5 rounded-full border border-foreground/35 sm:h-3 sm:w-3'
                        }
                      />
                      <div>
                        <p className="font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-muted-foreground">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute right-[3%] top-[28%] w-[29%] space-y-2 sm:space-y-3">
                  {HERO_RUBRICS.map(([title, detail]) => (
                    <div
                      key={title}
                      className="rounded-[0.4rem] border border-white/65 bg-background/70 px-2 py-2 shadow-sm backdrop-blur-sm sm:rounded-[0.55rem] sm:px-3 sm:py-2.5"
                    >
                      <p className="font-semibold text-foreground">{title}</p>
                      <p className="mt-0.5 text-muted-foreground">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
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
