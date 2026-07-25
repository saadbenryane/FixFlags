import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { AssuranceRow } from '@/components/marketing/landing/AssuranceRow'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'

/** Official glass hero (RGBA). Cropped transparent padding only — no re-key/resample. */
const HERO_GLASS = {
  src: '/marketing/visuals/home-hero-glass.png',
  width: 901,
  height: 790,
} as const

export function LandingHeroSection() {
  return (
    <Section spacing="marketing" className="overflow-hidden pb-10 sm:pb-12 lg:pb-14">
      <Container variant="wide" className="space-y-12 lg:space-y-14">
        <div className="grid items-center gap-10 md:gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-4 xl:gap-8">
          <div className="order-1 flex max-w-xl flex-col gap-5 sm:gap-6 lg:max-w-[34rem] xl:max-w-[36rem]">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-label text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              {HERO.badge}
            </p>

            <div className="space-y-3.5 sm:space-y-4">
              <Heading
                as="h1"
                className="max-w-[13ch] text-[2.375rem] leading-[1.04] tracking-display sm:text-[2.75rem] sm:leading-[1.05] lg:text-[3.25rem] xl:text-[3.5rem]"
              >
                {HERO.headlineDisplay}
                {HERO.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </Heading>
              <p className="max-w-[34ch] text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty sm:max-w-md sm:text-base lg:text-lg">
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

            <div className="pt-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                asChild
                className="h-auto px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                <Link href="/#sample-review">
                  {HERO.trySampleCta}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          {/* Illustration: denser after alpha crop; larger optical size, right-weighted on desktop */}
          <div className="order-2 mx-auto w-full max-w-[24rem] sm:max-w-[28rem] lg:mx-0 lg:max-w-none lg:justify-self-end lg:pl-2 xl:pl-0">
            <div
              className="relative mx-auto w-full lg:mx-0 lg:ml-auto lg:w-[min(100%,36rem)] xl:w-[min(100%,40rem)]"
              style={{ aspectRatio: `${HERO_GLASS.width} / ${HERO_GLASS.height}` }}
            >
              <Image
                src={HERO_GLASS.src}
                alt=""
                width={HERO_GLASS.width}
                height={HERO_GLASS.height}
                priority
                unoptimized
                sizes="(min-width: 1280px) 40rem, (min-width: 1024px) 36rem, (min-width: 640px) 28rem, 24rem"
                className="h-full w-full select-none object-contain object-center lg:object-right"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <EditorToolMarks
          compact
          showLabel
          className="border-t border-border/40 pt-8 sm:pt-10 [&_p]:font-mono [&_p]:text-[0.6875rem] [&_p]:uppercase [&_p]:tracking-label [&_ul]:justify-start sm:[&_ul]:justify-center lg:[&_ul]:justify-start"
        />
      </Container>
    </Section>
  )
}
