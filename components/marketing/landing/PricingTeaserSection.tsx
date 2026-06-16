import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { Body, Muted } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { PRICING_TEASER } from '@/lib/marketing/copy'

export function PricingTeaserSection() {
  return (
    <Section spacing="marketing" id="pricing" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-10 sm:space-y-12">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <LandingSectionHeader label="Pricing" headline={PRICING_TEASER.headline} />
          <Body className="text-muted-foreground">{PRICING_TEASER.subhead}</Body>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {PRICING_TEASER.plans.map((plan) => (
            <Card key={plan.name} className="flex h-full flex-col border-0 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-sm font-medium text-pretty">{plan.outcome}</p>
                <p className="mt-2 font-mono text-2xl tabular-nums">{plan.price}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <TextLink href="/pricing" className="text-sm font-medium">
            {PRICING_TEASER.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </TextLink>
          <Muted className="text-xs">{PRICING_TEASER.trustLine}</Muted>
        </div>
      </Container>
    </Section>
  )
}
