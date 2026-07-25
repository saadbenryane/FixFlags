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

/** Cropped from white mockup (opaque). Do not regenerate or chroma-key. */
const STACK = {
  src: '/marketing/visuals/ai-gap-stack.webp',
  width: 274,
  height: 394,
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
      className={cn(
        'hidden shrink-0 self-center lg:block',
        'h-px w-8 sm:w-10',
        brand ? 'opacity-90' : 'opacity-55'
      )}
      style={{
        backgroundImage: brand
          ? 'repeating-linear-gradient(90deg, hsl(var(--brand)) 0 3px, transparent 3px 6px)'
          : 'repeating-linear-gradient(90deg, hsl(var(--brand) / 0.55) 0 3px, transparent 3px 6px)',
      }}
    />
  )
}

function AiGapStack() {
  const annotations = HOW_IT_WORKS_PAGE.hero.annotations

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1.15fr)_minmax(12rem,0.85fr)] lg:items-center lg:gap-2">
      <div
        className="relative mx-auto w-full max-w-[22rem] lg:max-w-none"
        style={{ aspectRatio: `${STACK.width} / ${STACK.height}` }}
      >
        <Image
          src={STACK.src}
          alt=""
          width={STACK.width}
          height={STACK.height}
          priority
          unoptimized
          className="h-full w-full object-contain object-center"
        />
      </div>

      <ul className="flex flex-col justify-between gap-6 lg:min-h-[16rem] lg:gap-8 lg:py-4">
        {annotations.map((item) => {
          const isBrand = item.tone === 'brand'
          return (
            <li key={item.id} className="flex items-start gap-2">
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
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{item.body}</p>
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
      <Container variant="wide" className="space-y-10 lg:space-y-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-16">
          <div className="space-y-5">
            <BrandDotEyebrow>{hero.eyebrow}</BrandDotEyebrow>
            <div className="space-y-4">
              <Heading as="h1" className="max-w-xl text-4xl sm:text-5xl lg:text-[3.25rem]">
                {headlineWithoutPeriod}
                {hero.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </Heading>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                {hero.subhead}
              </p>
            </div>
          </div>

          <AiGapStack />
        </div>

        <div className="rounded-card bg-muted/70 p-5 shadow-sm sm:p-6 lg:p-7">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
            {hero.features.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon]
              return (
                <li key={feature.title} className="flex flex-col gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
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
