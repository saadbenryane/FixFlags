import { Globe2, MessageSquare, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const ICONS = {
  message: MessageSquare,
  experience: Sparkles,
  reach: Globe2,
} as const

const TINTS = {
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
} as const

export function ThreePlacesSection() {
  const { label, headline, cards } = LANDING_PAGE.threePlaces

  return (
    <Section spacing="marketing" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-12 sm:space-y-14">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {cards.map((card) => {
            const Icon = ICONS[card.icon as keyof typeof ICONS]
            return (
              <Card key={card.id} className="flex h-full flex-col border-0 p-6 shadow-card">
                <span
                  className={cn(
                    'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md',
                    TINTS[card.tint as keyof typeof TINTS]
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                  {card.title}
                </p>
                <p className="mt-2 text-base font-semibold leading-snug text-balance">{card.question}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {card.body}
                </p>
              </Card>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
