'use client'
import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { PricingComparisonTable } from '@/components/pricing/PricingComparisonTable'
import { FaqSection } from '@/components/marketing/FaqSection'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Surface } from '@/components/ui/surface'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { PLANS, PRICING, PRICING_FAQ } from '@/lib/marketing/copy'
import { CONTACT_PLAN } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'
import { useMe } from '@/hooks/useMe'
import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'

export function PricingPageClient() {
  useEffect(() => {
    trackEvent('viewed_pricing')
  }, [])
  const { user } = useMe()
  const currentPlan = user?.plan ?? 'FREE'
  const isLoggedIn = !!user

  return (
    <Section spacing="marketing" className="relative">
      <Container className="space-y-8 sm:space-y-11">
        <div className="mx-auto max-w-3xl text-center">
          <Heading as="h1" className="text-balance">
            {PRICING.headline}
          </Heading>
          <Body className="mx-auto mt-4 max-w-2xl text-muted-foreground text-pretty">
            {PRICING.subhead}
          </Body>
          <div className="mt-5 inline-flex items-center rounded-full bg-brand-muted px-3 py-1 text-xs font-medium text-brand">
            {PRICING.trustBadge}
          </div>
        </div>

        <h2 className="sr-only">Plans</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'relative flex h-full flex-col overflow-hidden shadow-card',
                plan.highlight && 'bg-brand/[0.04] shadow-card-hover ring-2 ring-brand/20'
              )}
            >
              {plan.highlight && (
                <span className="absolute right-4 top-4 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground">
                  Best for frequent checks
                </span>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="pr-28 text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.persona}</CardDescription>
                <p className="pt-3 text-sm font-medium leading-snug text-pretty">{plan.outcome}</p>
                <div className="flex items-end gap-1 pt-3">
                  <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
                    {plan.price}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{plan.audits}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-5">
                <ul className="flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <PricingCTAButton
                  plan={plan.plan}
                  cta={plan.cta}
                  signUpHref={plan.href as Route}
                  highlight={plan.highlight}
                  isLoggedIn={isLoggedIn}
                  currentPlan={currentPlan}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Surface
          variant="elevated"
          className="grid gap-5 p-5 shadow-card sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
        >
          <div>
            <p className="text-lg font-semibold tracking-heading">{CONTACT_PLAN.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{CONTACT_PLAN.outcome}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {CONTACT_PLAN.features.map((feature) => (
                <span key={feature} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />
                  {feature}
                </span>
              ))}
            </div>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={CONTACT_PLAN.href}>
              {CONTACT_PLAN.cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </Surface>

        <div className="space-y-5">
          <div className="mx-auto max-w-2xl text-center">
            <Heading as="h2">Compare plans</Heading>
            <Muted className="mt-2 text-sm">{PRICING.allPlansInclude}</Muted>
          </div>
          <PricingComparisonTable />
        </div>

        <div className="mx-auto max-w-3xl">
          <FaqSection items={PRICING_FAQ} title="Pricing questions" sectionLabel={null} />
        </div>
      </Container>
    </Section>
  )
}
