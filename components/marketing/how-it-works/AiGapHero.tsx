import type { ReactNode } from 'react'
import Image from 'next/image'
import {
  AlertTriangle,
  CheckCircle2,
  Rocket,
  Shield,
  Sparkles,
} from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HOW_IT_WORKS_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const FEATURE_ICONS = {
  sparkles: Sparkles,
  warning: AlertTriangle,
  shield: Shield,
  check: CheckCircle2,
  rocket: Rocket,
} as const

/** Isolated white-bg stack plate. Soft page-white key only, do not regenerate. */
const STACK = {
  src: '/marketing/visuals/ai-gap-stack.webp',
  width: 490,
  height: 477,
} as const

function BrandDotEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-label text-brand">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
      {children}
    </p>
  )
}

function AnnotationLeader({ brand }: { brand: boolean }) {
  return (
    <div
      aria-hidden
      className={cn('mt-[0.55rem] hidden h-px shrink-0 lg:block', brand ? 'w-11' : 'w-9')}
      style={{
        backgroundImage: brand
          ? 'repeating-linear-gradient(90deg, hsl(var(--brand)) 0 2px, transparent 2px 5px)'
          : 'repeating-linear-gradient(90deg, hsl(var(--brand) / 0.45) 0 2px, transparent 2px 5px)',
      }}
    />
  )
}

function AiGapStack() {
  const annotations = HOW_IT_WORKS_PAGE.hero.annotations

  return (
    <div className="mx-auto grid w-full max-w-lg grid-cols-1 items-center gap-8 lg:max-w-none lg:grid-cols-[minmax(0,1.15fr)_minmax(11rem,0.7fr)] lg:gap-0 xl:gap-1">
      <div
        className="relative mx-auto w-full max-w-[24rem] lg:max-w-none"
        style={{ aspectRatio: `${STACK.width} / ${STACK.height}` }}
      >
        <Image
          src={STACK.src}
          alt=""
          width={STACK.width}
          height={STACK.height}
          priority
          unoptimized
          className="h-full w-full select-none object-contain object-center"
          draggable={false}
        />
      </div>

      <ul className="flex flex-col gap-5 lg:h-full lg:justify-between lg:gap-0 lg:py-[11%] xl:py-[13%]">
        {annotations.map((item) => {
          const isBrand = item.tone === 'brand'
          return (
            <li key={item.id} className="flex items-start gap-2.5">
              <AnnotationLeader brand={isBrand} />
              <div className="min-w-0">
                <p
                  className={cn(
                    'font-mono text-[0.6875rem] font-semibold uppercase tracking-label',
                    isBrand ? 'text-brand' : 'text-foreground'
                  )}
                >
                  {item.title}
                  {item.percent ? (
                    <span className={cn(isBrand ? 'text-brand' : 'text-muted-foreground')}>
                      {' '}
                      {item.percent}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 max-w-[15rem] text-sm leading-snug text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AiGapHero() {
  const { hero } = HOW_IT_WORKS_PAGE
  const headlineWithoutPeriod = hero.headline.replace(/\.$/, '')

  return (
    <Section spacing="marketing" className="overflow-hidden">
      <Container variant="wide" className="space-y-10 lg:space-y-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.22fr)] lg:gap-6 xl:gap-10">
          <div className="max-w-xl space-y-5 lg:max-w-none">
            <BrandDotEyebrow>{hero.eyebrow}</BrandDotEyebrow>
            <div className="space-y-4">
              <Heading
                as="h1"
                className="max-w-[18ch] font-display text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-[3.15rem] xl:text-[3.4rem]"
              >
                {headlineWithoutPeriod}
                {hero.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </Heading>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                {hero.subhead}
              </p>
            </div>
          </div>

          <AiGapStack />
        </div>

        {/* Soft elevation only, no inset ring (mockup feature strip has no hard outline). */}
        <div className="rounded-card bg-background px-5 py-6 shadow-glass-subtle sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6 xl:gap-8">
            {hero.features.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon]
              return (
                <li key={feature.title} className="flex flex-col gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {feature.title}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </Container>
    </Section>
  )
}
