import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const TINTS = {
  brand: {
    iconColor: 'text-brand',
    wash: 'from-brand/14 via-brand/6 to-transparent',
  },
  success: {
    iconColor: 'text-success',
    wash: 'from-success/14 via-success/6 to-transparent',
  },
  info: {
    iconColor: 'text-info',
    wash: 'from-info/14 via-info/6 to-transparent',
  },
} as const

type DimensionId = (typeof LANDING_PAGE.checkDimensions.cards)[number]['id']

function DimensionScene({ id }: { id: DimensionId }) {
  const isMessage = id === 'message'
  const isExperience = id === 'experience'
  const imagePosition = isMessage ? 'object-[8%_52%]' : isExperience ? 'object-[43%_50%]' : 'object-[70%_50%]'

  return (
    <div className="relative mb-6 h-40 overflow-hidden rounded-nested-md border border-border-subtle bg-muted/35 shadow-card">
      <Image
        src="/marketing/brand-product-moments.webp"
        alt=""
        fill
        sizes="(min-width: 768px) 33vw, 100vw"
        className={cn('object-cover opacity-95', imagePosition)}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.16),hsl(var(--background)/0.72)_72%,hsl(var(--background)/0.84))]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent"
      />

      {isMessage ? (
        <>
          <div className="absolute right-4 top-4 w-40 rounded-nested-md border border-border-subtle bg-background/72 p-3 shadow-glass backdrop-blur-xl">
            <span className="mb-2 block h-2 w-16 rounded-full bg-brand/80" />
            <span className="mb-1.5 block h-1.5 w-28 rounded-full bg-foreground/18" />
            <span className="mb-3 block h-1.5 w-20 rounded-full bg-foreground/12" />
            <span className="inline-flex rounded-full bg-brand/12 px-2 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-label text-brand">
              Message
            </span>
          </div>
          <div className="absolute bottom-4 left-5 rounded-full border border-brand/20 bg-background/75 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-xl">
            Clarity in first view
          </div>
        </>
      ) : isExperience ? (
        <>
          <div className="absolute left-5 top-4 h-28 w-16 rounded-nested-sm border border-border-subtle bg-background/64 shadow-glass backdrop-blur-xl">
            <span className="absolute left-1/2 top-2 h-1 w-5 -translate-x-1/2 rounded-full bg-foreground/16" />
            <span className="absolute left-3 top-8 h-3 w-10 rounded-full bg-foreground/10" />
            <span className="absolute left-3 top-14 h-3 w-10 rounded-full bg-foreground/10" />
            <span className="absolute bottom-3 left-3 h-4 w-10 rounded-full bg-brand" />
            <span className="absolute bottom-8 left-2 h-8 w-12 rounded-sm border-2 border-dashed border-brand/85 bg-brand/10 shadow-[0_0_0_2px_hsl(var(--brand)/0.12)]" />
          </div>
          <div className="absolute bottom-4 right-4 rounded-nested-md border border-border-subtle bg-background/78 px-3 py-2 shadow-card backdrop-blur-xl">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-label text-brand">
              High
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-tight">
              CTA below fold
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="absolute left-5 top-5 h-20 w-32 rounded-nested-md border border-border-subtle bg-background/70 p-3 shadow-glass backdrop-blur-xl">
            <span className="mb-2 block h-2 w-10 rounded-full bg-brand/70" />
            <span className="mb-1.5 block h-1.5 w-24 rounded-full bg-foreground/16" />
            <span className="block h-1.5 w-16 rounded-full bg-foreground/10" />
          </div>
          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-border-subtle bg-background/78 px-3 py-2 text-[11px] font-semibold shadow-card backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-info" />
            Share preview ready
          </div>
        </>
      )}
    </div>
  )
}

export function CheckDimensionsSection() {
  const { label, headline, exampleFindingLabel, cards } = LANDING_PAGE.checkDimensions

  return (
    <Section spacing="marketing" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-8 sm:space-y-11">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="grid gap-5 md:grid-cols-3 lg:gap-6">
          {cards.map((d, index) => {
            const tint = TINTS[d.tint]
            return (
              <RevealOnView key={d.id} delayMs={index * 80} className="h-full">
                <Card
                  interactive
                  variant="strong"
                  className={cn(
                    'group relative flex h-full flex-col overflow-hidden p-6 sm:p-7',
                    'motion-safe:transition-[box-shadow,transform] motion-safe:duration-300 motion-safe:ease-out',
                    'hover:shadow-raised'
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 transition-opacity duration-300 ease-out group-hover:opacity-100',
                      tint.wash
                    )}
                  />

                  <div className="relative flex flex-1 flex-col">
                    <DimensionScene id={d.id} />
                    <p className={cn('text-xl font-bold tracking-heading', tint.iconColor)}>
                      {d.title}
                    </p>
                    <p className="mt-2 text-lg font-semibold leading-snug text-balance">
                      {d.question}
                    </p>

                    <ul className="mt-5 space-y-2.5">
                      {d.checks.map((check) => (
                        <li key={check} className="flex items-start gap-2.5 text-sm leading-snug">
                          <CheckCircle2
                            className={cn('mt-0.5 h-4 w-4 shrink-0', tint.iconColor)}
                            aria-hidden
                          />
                          <span className="text-pretty">{check}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 rounded-nested-md bg-muted/35 px-4 py-3.5">
                      <p className="meta-label text-muted-foreground/70">
                        {exampleFindingLabel}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
                        {d.proofExample.finding}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
                        {d.proofExample.evidence}
                      </p>
                    </div>
                  </div>
                </Card>
              </RevealOnView>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
