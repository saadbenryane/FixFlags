import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Lock, ShieldCheck, Zap } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'

/** Official glass hero: black-matte unmated to RGBA so mesh shows through (no white plate / black fringe). */
const HERO_GLASS = {
  src: '/marketing/visuals/home-hero-glass.webp',
  width: 581,
  height: 546,
} as const

const ASSURANCE_ICONS = {
  shield: ShieldCheck,
  lock: Lock,
  zap: Zap,
} as const

export function LandingHeroSection() {
  return (
    <Section spacing="marketing" className="overflow-hidden pb-10 sm:pb-12 lg:pb-14">
      <Container variant="wide" className="space-y-12 lg:space-y-14">
        <div className="grid items-center gap-10 md:gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-6 xl:gap-10">
          {/* Copy column */}
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

            {/* Assurances: stacked on mobile, divided row on sm+ */}
            <ul className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
              {HERO.assurances.map((item, index) => {
                const Icon = ASSURANCE_ICONS[item.icon]
                return (
                  <li
                    key={item.id}
                    className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground sm:text-sm"
                  >
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className="mx-3 hidden h-3.5 w-px shrink-0 bg-border sm:inline-block"
                      />
                    ) : null}
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </li>
                )
              })}
            </ul>

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

          {/* Illustration: below copy on mobile, right on desktop */}
          <div className="order-2 mx-auto w-full max-w-[22rem] sm:max-w-[26rem] lg:mx-0 lg:max-w-none lg:justify-self-end">
            <div
              className="relative w-full"
              style={{ aspectRatio: `${HERO_GLASS.width} / ${HERO_GLASS.height}` }}
            >
              <Image
                src={HERO_GLASS.src}
                alt=""
                width={HERO_GLASS.width}
                height={HERO_GLASS.height}
                priority
                unoptimized
                sizes="(min-width: 1024px) 42vw, (min-width: 640px) 26rem, 22rem"
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
