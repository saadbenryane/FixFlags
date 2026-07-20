import Image from 'next/image'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { HowItWorksSampleLink } from '@/components/marketing/landing/SampleFunnelEvents'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type LoopStep = (typeof LANDING_PAGE.howItWorks.steps)[number]

const LOOP_PANORAMA = {
  light: '/marketing/visuals/loop-light.webp',
  dark: '/marketing/visuals/loop-dark.webp',
  width: 1600,
  height: 686,
} as const

/**
 * Subject-centered square tiles (~12–14KB each) for mobile.
 * Pre-cropped so each step is framed without sliding a wide panorama.
 */
const LOOP_TILES = [
  {
    light: '/marketing/visuals/loop-01-light.webp',
    dark: '/marketing/visuals/loop-01-dark.webp',
  },
  {
    light: '/marketing/visuals/loop-02-light.webp',
    dark: '/marketing/visuals/loop-02-dark.webp',
  },
  {
    light: '/marketing/visuals/loop-03-light.webp',
    dark: '/marketing/visuals/loop-03-dark.webp',
  },
] as const

const TILE_SIZES = '90vw'
const PANORAMA_SIZES = '(min-width: 1024px) 1024px, 100vw'

function LoopPanorama() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: `${LOOP_PANORAMA.width} / ${LOOP_PANORAMA.height}` }}
    >
      <Image
        src={LOOP_PANORAMA.light}
        alt=""
        fill
        sizes={PANORAMA_SIZES}
        quality={82}
        className="object-cover object-center dark:hidden"
      />
      <Image
        src={LOOP_PANORAMA.dark}
        alt=""
        fill
        sizes={PANORAMA_SIZES}
        quality={82}
        className="hidden object-cover object-center dark:block"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background/25 to-transparent"
      />
    </div>
  )
}

function LoopThirdScene({ index, className }: { index: number; className?: string }) {
  const tile = LOOP_TILES[Math.min(Math.max(index, 0), LOOP_TILES.length - 1)]!

  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-nested-md bg-muted/35 shadow-glass',
        className,
      )}
    >
      <Image
        src={tile.light}
        alt=""
        fill
        sizes={TILE_SIZES}
        quality={82}
        className="object-cover object-center dark:hidden"
      />
      <Image
        src={tile.dark}
        alt=""
        fill
        sizes={TILE_SIZES}
        quality={82}
        className="hidden object-cover object-center dark:block"
      />
    </div>
  )
}

function StepCopy({ step, index }: { step: LoopStep; index: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-mono text-xs font-bold tabular-nums text-brand-foreground shadow-sm">
          {String(step.step).padStart(2, '0')}
        </span>
        <h3 className="text-base font-bold">{step.title}</h3>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>

      <div className="mt-4 flex min-h-9 items-center gap-2 rounded-full bg-muted/55 px-3 py-2">
        {index === 0 ? <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> : null}
        {'previewBadge' in step && step.previewBadge ? (
          <span className="rounded-full bg-brand/12 px-2 py-0.5 text-2xs font-bold text-brand">
            {step.previewBadge}
          </span>
        ) : null}
        <span className="truncate font-mono text-xs text-foreground/80">{step.preview}</span>
      </div>
    </div>
  )
}

interface HowItWorksLoopSectionProps {
  sampleHref?: string
}

export function HowItWorksLoopSection({ sampleHref = '/samples' }: HowItWorksLoopSectionProps) {
  const { headline, subhead, sampleLink, steps } = LANDING_PAGE.howItWorks

  return (
    <Section
      spacing="marketing"
      id="how-it-works"
      className="relative scroll-mt-[var(--header-offset)] overflow-hidden bg-muted/20"
    >
      <Container className="relative space-y-5 sm:space-y-7">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <LandingSectionHeader headline={headline} />
          <p className="text-base leading-relaxed text-muted-foreground text-pretty">{subhead}</p>
        </div>

        <RevealOnView>
          <div className="overflow-hidden rounded-card glass-surface-elevated shadow-card">
            <div className="hidden md:block">
              <LoopPanorama />

              <div className="relative grid grid-cols-3 gap-0 px-3 pb-5 pt-4 lg:px-5 lg:pb-6">
                <div
                  aria-hidden
                  className="absolute left-[14%] right-[14%] top-11 h-px bg-gradient-to-r from-brand/15 via-brand/55 to-brand/15"
                />
                {steps.map((step, index) => (
                  <article key={step.title} className="min-w-0 px-3 lg:px-4">
                    <StepCopy step={step} index={index} />
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-px bg-border/45 md:hidden">
              {steps.map((step, index) => (
                <article key={step.title} className="bg-background/85 p-5 sm:p-6">
                  <LoopThirdScene index={index} />
                  <div className="mt-5">
                    <StepCopy step={step} index={index} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </RevealOnView>

        <div className="flex justify-center">
          <HowItWorksSampleLink href={sampleHref} label={sampleLink} />
        </div>
      </Container>
    </Section>
  )
}
