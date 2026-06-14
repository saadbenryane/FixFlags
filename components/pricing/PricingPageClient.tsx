'use client'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { PricingComparisonTable } from '@/components/pricing/PricingComparisonTable'
import { ExpertReviewButton } from '@/components/pricing/ExpertReviewButton'
import { FaqSection } from '@/components/marketing/FaqSection'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Surface } from '@/components/ui/surface'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { PLANS, PRICING, PRICING_FAQ } from '@/lib/marketing/copy'
import { CONTACT_PLAN, hasActiveFoundingOffer } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'
import { useMe } from '@/hooks/useMe'

export function PricingPageClient() {
  const { user } = useMe()
  const currentPlan = user?.plan ?? 'FREE'
  const isLoggedIn = !!user

  return (
    <Section spacing="default">
      <Container className="space-y-12">
        <div className="mx-auto max-w-prose space-y-4 text-center">
          <Heading as="h1">{PRICING.headline}</Heading>
          <Body className="text-muted-foreground">{PRICING.subhead}</Body>
          {hasActiveFoundingOffer() && (
            <div className="inline-block rounded-full bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand">
              {PRICING.foundingBadge}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'relative flex h-full flex-col border-0 shadow-card',
                plan.highlight && 'bg-brand/[0.03] shadow-card-hover'
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
                  Popular
                </span>
              )}
              <CardHeader className={cn(plan.highlight && 'pt-8')}>
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.persona}</p>
                  <p className="mt-2 text-sm font-medium text-pretty">{plan.outcome}</p>
                  <div className="mt-2">
                    <span className="font-display text-3xl">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.founding && (
                    <div className="mt-1 text-xs font-medium text-brand">{plan.founding}</div>
                  )}
                </div>
                <CardDescription className="mt-1 text-xs font-medium">{plan.audits}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-4">
                <ul className="flex-1 space-y-2">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <PricingCTAButton
                    plan={plan.plan}
                    cta={plan.cta}
                    signUpHref={plan.href}
                    highlight={plan.highlight}
                    isLoggedIn={isLoggedIn}
                    currentPlan={currentPlan}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="flex h-full flex-col border-0 shadow-card">
            <CardHeader>
              <CardTitle>{CONTACT_PLAN.name}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{CONTACT_PLAN.persona}</p>
              <p className="mt-2 text-sm font-medium text-pretty">{CONTACT_PLAN.outcome}</p>
              <div className="mt-2">
                <span className="font-display text-3xl">{CONTACT_PLAN.price}</span>
              </div>
              <CardDescription className="mt-1 text-xs font-medium">{CONTACT_PLAN.audits}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              <ul className="space-y-2">
                {CONTACT_PLAN.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href={CONTACT_PLAN.href}>{CONTACT_PLAN.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <PricingComparisonTable />

        <Muted className="text-center text-sm">{PRICING.allPlansInclude}</Muted>

        <Surface variant="elevated" className="mx-auto max-w-3xl space-y-4 text-center">
          <Heading as="h3">{PRICING.expertReview.title}</Heading>
          <Body className="text-muted-foreground">{PRICING.expertReview.body}</Body>
          <ol className="mx-auto max-w-md list-inside list-decimal space-y-2 text-left text-sm text-muted-foreground">
            {PRICING.expertReview.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <ExpertReviewButton isLoggedIn={isLoggedIn} label={PRICING.expertReview.cta} />
        </Surface>

        <div className="mx-auto max-w-prose">
          <FaqSection items={PRICING_FAQ} title="Pricing questions" />
        </div>
      </Container>
    </Section>
  )
}
