import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const TINTS = {
  brand: 'text-brand',
  success: 'text-success',
  info: 'text-info',
} as const

type DimensionId = (typeof LANDING_PAGE.checkDimensions.cards)[number]['id']

const RUBRICS_PANORAMA = {
  light: '/marketing/visuals/rubrics-light.webp',
  dark: '/marketing/visuals/rubrics-dark.webp',
} as const

const RUBRICS_TILES: Record<DimensionId, { light: string; dark: string }> = {
  message: {
    light: '/marketing/visuals/rubrics-01-light.webp',
    dark: '/marketing/visuals/rubrics-01-dark.webp',
  },
  experience: {
    light: '/marketing/visuals/rubrics-02-light.webp',
    dark: '/marketing/visuals/rubrics-02-dark.webp',
  },
  reach: {
    light: '/marketing/visuals/rubrics-03-light.webp',
    dark: '/marketing/visuals/rubrics-03-dark.webp',
  },
}

const TILE_SIZES = '90vw'
const PANORAMA_SIZES = '(min-width: 1024px) 1024px, 100vw'

function PanoramaImage({ className = '' }: { className?: string }) {
  return (
    <>
      <Image
        src={RUBRICS_PANORAMA.light}
        alt=""
        fill
        sizes={PANORAMA_SIZES}
        loading="lazy"
        className={cn('object-cover dark:hidden', className)}
      />
      <Image
        src={RUBRICS_PANORAMA.dark}
        alt=""
        fill
        sizes={PANORAMA_SIZES}
        loading="lazy"
        className={cn('hidden object-cover dark:block', className)}
      />
    </>
  )
}

function MobileDimensionScene({ id }: { id: DimensionId }) {
  const tile = RUBRICS_TILES[id]

  return (
    <div className="relative aspect-square overflow-hidden rounded-nested-md bg-muted/35 shadow-glass md:hidden">
      <Image
        src={tile.light}
        alt=""
        fill
        sizes={TILE_SIZES}
        loading="lazy"
        className="object-cover object-center dark:hidden"
      />
      <Image
        src={tile.dark}
        alt=""
        fill
        sizes={TILE_SIZES}
        loading="lazy"
        className="hidden object-cover object-center dark:block"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/35 to-transparent" />
    </div>
  )
}

export function CheckDimensionsSection() {
  const { label, headline, exampleFindingLabel, cards } = LANDING_PAGE.checkDimensions

  return (
    <Section spacing="marketing" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-8 sm:space-y-11">
        <LandingSectionHeader label={label} headline={headline} />

        <RevealOnView>
          <div className="overflow-hidden rounded-card glass-surface-elevated shadow-card">
            <div className="relative hidden aspect-[3/1] overflow-hidden md:block">
              <PanoramaImage />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/35 to-transparent"
              />
            </div>

            <div className="grid md:grid-cols-3">
              {cards.map((dimension, index) => {
                const tint = TINTS[dimension.tint]

                return (
                  <article
                    key={dimension.id}
                    className={cn(
                      'relative flex min-w-0 flex-col p-5 sm:p-7 lg:p-8',
                      index > 0 && 'border-t border-border/45 md:border-l md:border-t-0'
                    )}
                  >
                    <MobileDimensionScene id={dimension.id} />

                    <div className="mt-6 md:mt-0">
                      <p className="meta-label text-muted-foreground/65">
                        {String(index + 1).padStart(2, '0')}
                      </p>
                      <h3 className={cn('mt-2 text-xl font-bold tracking-heading', tint)}>
                        {dimension.title}
                      </h3>
                      <p className="mt-2 text-lg font-semibold leading-snug text-balance">
                        {dimension.question}
                      </p>
                    </div>

                    <ul className="mt-5 space-y-2.5">
                      {dimension.checks.map((check) => (
                        <li key={check} className="flex items-start gap-2.5 text-sm leading-snug">
                          <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', tint)} aria-hidden />
                          <span className="text-pretty">{check}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 rounded-nested-md bg-muted/45 px-4 py-3.5">
                      <p className="meta-label text-muted-foreground/65">{exampleFindingLabel}</p>
                      <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
                        {dimension.proofExample.finding}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
                        {dimension.proofExample.evidence}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
