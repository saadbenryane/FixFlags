import { Globe2, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const ICONS = {
  message: MessageSquare,
  experience: Sparkles,
  trust: ShieldCheck,
  reach: Globe2,
} as const

const TINTS = {
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success/10 text-success',
  trust: 'bg-[hsl(270_60%_55%/0.12)] text-[hsl(270_55%_45%)] dark:text-[hsl(270_60%_72%)]',
  info: 'bg-info/10 text-info',
} as const

export function FourPlacesSection() {
  const { headline, cards } = LANDING_PAGE.fourPlaces

  return (
    <Section spacing="loose" id="what-it-checks" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-10 sm:space-y-12">
        <Heading as="h2" className="mx-auto max-w-2xl text-center">
          {headline}
        </Heading>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
          {cards.map((card) => {
            const Icon = ICONS[card.icon as keyof typeof ICONS]
            return (
              <Card key={card.id} className="border-0 p-6 shadow-card sm:p-7">
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
                      TINTS[card.tint as keyof typeof TINTS]
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">{card.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                      {card.body}
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
