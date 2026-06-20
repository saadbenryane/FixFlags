import { CheckCircle2, Globe2, MessageSquare, Zap } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const ICONS = {
  message: MessageSquare,
  experience: Zap,
  reach: Globe2,
} as const

const TINTS = {
  brand: {
    iconColor: 'text-brand',
    glow: 'bg-brand/20',
    wash: 'from-brand/14 via-brand/6 to-transparent',
  },
  success: {
    iconColor: 'text-success',
    glow: 'bg-success/20',
    wash: 'from-success/14 via-success/6 to-transparent',
  },
  info: {
    iconColor: 'text-info',
    glow: 'bg-info/20',
    wash: 'from-info/14 via-info/6 to-transparent',
  },
} as const

export function CheckDimensionsSection() {
  const { label, headline, exampleFindingLabel, cards } = LANDING_PAGE.checkDimensions

  return (
    <Section spacing="marketing" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-8 sm:space-y-11">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="grid gap-5 md:grid-cols-3 lg:gap-6">
          {cards.map((d, index) => {
            const Icon = ICONS[d.icon]
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
                  <div
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl',
                      'motion-safe:animate-card-glow-pulse motion-safe:[animation-delay:calc(var(--card-delay,0)*1s)]',
                      tint.glow
                    )}
                    style={{ '--card-delay': index * 1.4 } as CSSProperties}
                  />
                  <Icon
                    className={cn(
                      'pointer-events-none absolute -right-6 -top-6 h-32 w-32 transition-transform duration-500 ease-out',
                      'opacity-[0.07] group-hover:scale-110 group-hover:opacity-[0.11] motion-reduce:transition-none',
                      tint.iconColor
                    )}
                    aria-hidden
                  />

                  <div className="relative flex flex-1 flex-col">
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
