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

  return (
    <div className="relative mb-6 h-36 overflow-hidden rounded-nested-md bg-[radial-gradient(ellipse_80%_80%_at_25%_15%,hsl(var(--brand)/0.11),transparent_54%),linear-gradient(145deg,hsl(var(--background)/0.92),hsl(var(--muted)/0.72))] shadow-card">
      <div
        aria-hidden
        className="absolute -left-10 bottom-0 h-20 w-56 rounded-[50%] bg-background/70 blur-xl"
      />
      <div
        aria-hidden
        className="absolute right-5 top-4 h-28 w-28 rounded-full border border-border-subtle/80 bg-background/30 shadow-glass backdrop-blur-xl"
      />

      {isMessage ? (
        <>
          <div className="absolute left-6 top-6 h-20 w-32 rounded-[1.35rem] border border-border-subtle/80 bg-background/45 shadow-glass backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-2 w-12 rounded-full bg-brand/80" />
            <span className="absolute left-4 top-8 h-1.5 w-20 rounded-full bg-foreground/18" />
            <span className="absolute left-4 top-11 h-1.5 w-16 rounded-full bg-foreground/12" />
            <span className="absolute bottom-4 left-4 h-5 w-16 rounded-full bg-brand/10" />
          </div>
          <div className="absolute bottom-4 right-8 h-12 w-20 rounded-[1rem] border border-border-subtle/70 bg-background/50 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-1.5 w-12 rounded-full bg-foreground/18" />
            <span className="absolute left-4 top-7 h-1.5 w-8 rounded-full bg-brand/55" />
          </div>
        </>
      ) : isExperience ? (
        <>
          <div className="absolute left-8 top-4 h-28 w-16 rounded-[1.4rem] border border-border-subtle/80 bg-background/45 shadow-glass backdrop-blur-xl">
            <span className="absolute left-1/2 top-2 h-1 w-5 -translate-x-1/2 rounded-full bg-foreground/16" />
            <span className="absolute left-3 top-9 h-3 w-10 rounded-full bg-foreground/10" />
            <span className="absolute left-3 top-16 h-3 w-10 rounded-full bg-foreground/10" />
            <span className="absolute bottom-4 left-3 h-4 w-10 rounded-full bg-brand" />
          </div>
          <div className="absolute bottom-5 right-8 h-16 w-28 rounded-[1.2rem] border border-border-subtle/70 bg-background/45 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-2 w-20 rounded-full bg-success/55" />
            <span className="absolute left-4 top-8 h-1.5 w-14 rounded-full bg-foreground/14" />
            <span className="absolute bottom-3 right-4 h-5 w-5 rounded-full bg-success/15 ring-1 ring-success/35" />
          </div>
        </>
      ) : (
        <>
          <div className="absolute left-7 top-7 h-20 w-20 rounded-full border border-info/25 bg-background/35 shadow-glass backdrop-blur-xl">
            <span className="absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 rotate-[-24deg] bg-info/25" />
            <span className="absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 rotate-[24deg] bg-info/20" />
            <span className="absolute left-[46%] top-[46%] h-2.5 w-2.5 rounded-full bg-brand shadow-sm" />
            <span className="absolute right-3 top-4 h-2 w-2 rounded-full bg-info/55" />
          </div>
          <div className="absolute bottom-5 right-7 h-16 w-32 rounded-[1.1rem] border border-border-subtle/70 bg-background/48 shadow-card backdrop-blur-xl">
            <span className="absolute left-4 top-4 h-2 w-8 rounded-full bg-brand/70" />
            <span className="absolute left-4 top-8 h-1.5 w-20 rounded-full bg-foreground/16" />
            <span className="absolute left-4 top-12 h-1.5 w-14 rounded-full bg-foreground/10" />
          </div>
        </>
      )}

      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-6 w-48 -translate-x-1/2 rounded-[50%] bg-foreground/10 blur-xl"
      />
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
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
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
