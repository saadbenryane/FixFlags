import Link from 'next/link'
import { ArrowRight, MessageSquare, Zap, Globe2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'

const ICONS = {
  message: MessageSquare,
  experience: Zap,
  reach: Globe2,
} as const

export function ProductEvidenceSection() {
  const { headline, subhead, items, cta, ctaHref } = LANDING_PAGE.productEvidence

  return (
    <Section
      spacing="marketing"
      id="product-evidence"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-8 sm:space-y-10">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <LandingSectionHeader headline={headline} />
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{subhead}</p>
        </div>

        <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3 sm:gap-5">
          {items.map((item) => {
            const Icon = ICONS[item.id as keyof typeof ICONS] ?? MessageSquare
            return (
              <li
                key={item.id}
                className="rounded-card p-5 glass-surface shadow-card sm:p-6"
              >
                <Icon className="h-5 w-5 text-brand" aria-hidden />
                <h3 className="mt-3 font-serif text-lg font-medium tracking-heading text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {item.body}
                </p>
              </li>
            )
          })}
        </ul>

        <div className="flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={ctaHref}>
              {cta}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
