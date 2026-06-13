'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { ExpertReviewButton } from '@/components/pricing/ExpertReviewButton'
import { FaqSection } from '@/components/marketing/FaqSection'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { CheckCircle2 } from 'lucide-react'
import { PLANS, PRICING, PRICING_FAQ } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function PricingPageClient() {
  const [currentPlan, setCurrentPlan] = useState('FREE')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (data.user) {
          setIsLoggedIn(true)
          setCurrentPlan(data.user.plan ?? 'FREE')
        }
      })
      .catch(() => {})
  }, [])

  return (
    <Section spacing="default">
      <Container className="max-w-5xl space-y-12">
        <div className="space-y-4 text-center">
          <Heading as="h1">{PRICING.headline}</Heading>
          <Body className="text-muted-foreground">{PRICING.subhead}</Body>
          <div className="inline-block rounded-full bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand">
            {PRICING.foundingBadge}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                plan.highlight && 'border-brand/40 shadow-card-hover ring-1 ring-brand/20'
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.persona}</p>
                    <p className="mt-1 text-sm font-medium">{plan.outcome}</p>
                    <div className="mt-2">
                      <span className="font-display text-3xl">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    {plan.founding && (
                      <div className="mt-1 text-xs font-medium text-brand">{plan.founding}</div>
                    )}
                  </div>
                  {plan.highlight && (
                    <div className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
                      Popular
                    </div>
                  )}
                </div>
                <CardDescription className="mt-1 text-xs font-medium">{plan.audits}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
                <PricingCTAButton
                  plan={plan.plan}
                  cta={plan.cta}
                  signUpHref={plan.href}
                  highlight={plan.highlight}
                  isLoggedIn={isLoggedIn}
                  currentPlan={currentPlan}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Muted className="text-center text-sm">{PRICING.allPlansInclude}</Muted>

        <div className="marketing-panel space-y-4 p-8 text-center">
          <Heading as="h3">{PRICING.expertReview.title}</Heading>
          <Body className="text-muted-foreground">{PRICING.expertReview.body}</Body>
          <ol className="mx-auto max-w-md list-inside list-decimal space-y-2 text-left text-sm text-muted-foreground">
            {PRICING.expertReview.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <ExpertReviewButton
            isLoggedIn={isLoggedIn}
            label={PRICING.expertReview.cta}
          />
        </div>

        <div className="mx-auto max-w-2xl">
          <FaqSection items={PRICING_FAQ} title="Pricing questions" />
        </div>
      </Container>
    </Section>
  )
}
