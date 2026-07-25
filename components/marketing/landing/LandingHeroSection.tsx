import Image from 'next/image'
import { ChevronDown, Zap } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { AssuranceRow } from '@/components/marketing/landing/AssuranceRow'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'

/** Official glass hero (RGBA WebP). */
const HERO_GLASS = {
  src: '/marketing/visuals/home-hero-glass.webp',
  width: 853,
  height: 747,
} as const

export function LandingHeroSection() {
  return (
    <Section
      spacing="compact"
      className="relative flex min-h-0 flex-col overflow-x-clip pb-5 pt-3 sm:pb-6 sm:pt-4 lg:pb-7 lg:pt-5"
    >
      <Container variant="wide" className="flex flex-col xl:max-w-[80rem]">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-x-4 xl:gap-x-6">
          <div className="order-1 flex max-w-xl flex-col gap-3.5 sm:gap-4 lg:max-w-[34rem] lg:pt-2 xl:max-w-[36rem] xl:pt-3">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              {HERO.badge}
            </p>

            <div className="space-y-4 sm:space-y-[1.125rem]">
              <Heading
                as="h1"
                className="max-w-[14ch] text-[2.75rem] font-bold leading-[1.08] tracking-display sm:text-[3.125rem] sm:leading-[1.08] lg:text-[3.625rem] xl:text-[3.875rem]"
              >
                {HERO.headlineDisplay}
                {HERO.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </Heading>
              <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground/95 text-pretty sm:max-w-xl sm:text-base lg:max-w-[34rem] lg:text-[1.0625rem] lg:leading-relaxed">
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

            {/* Product-true trust band — horizontal layout matches mockup; no invented counts */}
            <div className="flex items-center gap-3 pt-0.5">
              <p className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <Zap className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} aria-hidden />
                <span className="font-medium leading-none">{HERO.trustLine}</span>
              </p>
            </div>

            <EditorToolMarks
              compact
              showLabel
              className="mt-1 space-y-2.5 [&_p]:font-mono [&_p]:text-[0.625rem] [&_p]:font-medium [&_p]:uppercase [&_p]:tracking-[0.16em] [&_p]:text-muted-foreground/85 [&_ul]:flex-nowrap [&_ul]:justify-start [&_ul]:gap-x-4 [&_ul]:gap-y-2 [&_li]:gap-1.5 [&_li]:text-[0.75rem] [&_li]:font-semibold [&_li]:tracking-normal [&_li]:text-foreground/75 [&_li_svg]:h-5 [&_li_svg]:w-5 [&_li_svg]:opacity-95"
            />
          </div>

          <div className="order-2 relative mx-auto w-full max-w-[24rem] sm:max-w-[28rem] lg:mx-0 lg:-mt-2 lg:flex lg:max-w-none lg:items-start lg:justify-self-end xl:-mt-3">
            <div
              aria-hidden
              className="pointer-events-none absolute left-[10%] top-[8%] h-[72%] w-[78%] rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--brand)/0.28),transparent_68%)] blur-[68px]"
            />
            <div
              className="relative mx-auto w-full lg:ml-auto lg:w-[min(108%,46rem)] xl:w-[min(110%,50rem)]"
              style={{ aspectRatio: `${HERO_GLASS.width} / ${HERO_GLASS.height}` }}
            >
              <Image
                src={HERO_GLASS.src}
                alt=""
                width={HERO_GLASS.width}
                height={HERO_GLASS.height}
                priority
                unoptimized
                sizes="(min-width: 1280px) 50rem, (min-width: 1024px) 46rem, (min-width: 640px) 28rem, 24rem"
                className="h-full w-full select-none object-contain object-center drop-shadow-[0_24px_48px_-12px_hsl(240_8%_5%/0.12)] lg:object-right"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <a
          href="#sample-review"
          className="mx-auto mt-4 flex w-fit flex-col items-center gap-0.5 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground/80 sm:mt-5"
        >
          {HERO.scrollHint}
          <ChevronDown className="h-3.5 w-3.5 animate-bounce motion-reduce:animate-none" aria-hidden />
        </a>
      </Container>
    </Section>
  )
}
