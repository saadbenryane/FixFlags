import Image from 'next/image'
import { ChevronDown, Zap } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { AssuranceRow } from '@/components/marketing/landing/AssuranceRow'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'

/** Official glass hero (RGBA WebP). No re-key/resample beyond encode. */
const HERO_GLASS = {
  src: '/marketing/visuals/home-hero-glass.webp',
  width: 901,
  height: 790,
} as const

export function LandingHeroSection() {
  return (
    <Section
      spacing="marketing"
      className="relative overflow-hidden pb-6 pt-2 sm:pb-8 lg:pb-10"
    >
      <Container variant="wide" className="xl:max-w-7xl">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:gap-x-4 xl:gap-x-8">
          <div className="order-1 flex max-w-xl flex-col gap-5 sm:gap-5 lg:max-w-[34rem] xl:max-w-[36rem]">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-label text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              {HERO.badge}
            </p>

            <div className="space-y-3 sm:space-y-3.5">
              <Heading
                as="h1"
                className="max-w-[14ch] text-[2.5rem] leading-[1.02] tracking-display sm:text-[2.875rem] sm:leading-[1.03] lg:text-[3.375rem] xl:text-[3.625rem]"
              >
                {HERO.headlineDisplay}
                {HERO.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </Heading>
              <p className="max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty sm:max-w-md sm:text-base lg:text-lg">
                {HERO.subhead}
              </p>
            </div>

            <div
              id="audit"
              className="w-full scroll-mt-[calc(var(--header-offset)+1rem)]"
            >
              <AuditInput
                variant="landing"
                idSuffix="-hero"
                ctaPlacement="hero"
                showLandingExtras={false}
              />
            </div>

            <AssuranceRow />

            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2} aria-hidden />
              <span className="font-medium text-foreground/80">{HERO.trustLine}</span>
            </p>

            <EditorToolMarks
              compact
              showLabel
              className="pt-1 [&_p]:font-mono [&_p]:text-[0.6875rem] [&_p]:uppercase [&_p]:tracking-label [&_ul]:justify-start [&_ul]:gap-x-4 [&_ul]:gap-y-2 [&_li]:text-[0.8125rem] [&_li_svg]:h-4 [&_li_svg]:w-4"
            />
          </div>

          <div className="order-2 relative mx-auto w-full max-w-[24rem] sm:max-w-[28rem] lg:mx-0 lg:max-w-none lg:justify-self-stretch">
            <div
              aria-hidden
              className="pointer-events-none absolute left-[12%] top-[18%] h-[58%] w-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--brand)/0.18),transparent_68%)] blur-2xl"
            />
            <div
              className="relative mx-auto w-full lg:ml-auto lg:mr-[-2%] lg:w-[min(108%,44rem)] xl:mr-[-4%] xl:w-[min(112%,48rem)]"
              style={{ aspectRatio: `${HERO_GLASS.width} / ${HERO_GLASS.height}` }}
            >
              <Image
                src={HERO_GLASS.src}
                alt=""
                width={HERO_GLASS.width}
                height={HERO_GLASS.height}
                priority
                unoptimized
                sizes="(min-width: 1280px) 48rem, (min-width: 1024px) 44rem, (min-width: 640px) 28rem, 24rem"
                className="h-full w-full select-none object-contain object-center drop-shadow-[0_28px_48px_hsl(240_8%_5%/0.14)] lg:object-right"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <a
          href="#sample-review"
          className="mx-auto mt-8 flex w-fit flex-col items-center gap-1 pb-1 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 transition-colors hover:text-muted-foreground sm:mt-10"
        >
          {HERO.scrollHint}
          <ChevronDown className="h-3.5 w-3.5 animate-bounce motion-reduce:animate-none" aria-hidden />
        </a>
      </Container>
    </Section>
  )
}
