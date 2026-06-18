import { CheckCircle2, Globe2, MessageSquare, Zap } from 'lucide-react'
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
    iconWash: 'text-brand/10',
    border: 'border-brand/20',
    surface: 'bg-brand/[0.035]',
  },
  success: {
    iconColor: 'text-success',
    iconWash: 'text-success/10',
    border: 'border-success/20',
    surface: 'bg-success/[0.035]',
  },
  info: {
    iconColor: 'text-info',
    iconWash: 'text-info/10',
    border: 'border-info/20',
    surface: 'bg-info/[0.035]',
  },
} as const

export function CheckDimensionsSection() {
  const { label, headline, cards } = LANDING_PAGE.checkDimensions

  return (
    <Section spacing="marketing" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-12 sm:space-y-16">
        <LandingSectionHeader
          label={label}
          headline={headline}
        />

        <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
          {cards.map((d, index) => {
            const Icon = ICONS[d.icon]
            const tint = TINTS[d.tint]
            return (
              <RevealOnView key={d.id} delayMs={index * 50} className="h-full">
                <Card
                  interactive
                  className={cn(
                    'group relative flex h-full min-h-[21rem] flex-col overflow-hidden border p-6 shadow-card',
                    tint.border,
                    tint.surface
                  )}
                >
                  <Icon
                    className={cn(
                      'pointer-events-none absolute -right-8 -top-8 h-40 w-40 transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none',
                      tint.iconWash
                    )}
                    aria-hidden
                  />
                  <div className="relative">
                    <p className={cn('text-xl font-bold tracking-heading', tint.iconColor)}>
                      {d.title}
                    </p>
                    <p className="mt-2 text-lg font-semibold leading-snug text-balance">
                      {d.question}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                      {d.body}
                    </p>
                  </div>

                  <div className="relative mt-6 border-t border-border/40 pt-5">
                    <p className="text-xs font-semibold text-muted-foreground">We verify</p>
                    <ul className="mt-3 space-y-2.5">
                      {d.checks.map((check) => (
                        <li key={check} className="flex items-start gap-2.5 text-sm leading-snug">
                          <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', tint.iconColor)} aria-hidden />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
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
