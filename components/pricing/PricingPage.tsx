import type { Route } from 'next'
import Link from 'next/link'
import { Check, Flag, ShieldCheck, Users } from 'lucide-react'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { PlanPrice } from '@/components/pricing/PlanPrice'
import { PricingViewTracker } from '@/components/pricing/PricingViewTracker'
import { PricingComparisonTable } from '@/components/pricing/PricingComparisonTable'
import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { PRICING, PRICING_CARDS, PRICING_FAQ } from '@/lib/marketing/copy/plans'
import { cn } from '@/lib/utils'

const PLAN_ICONS = { FREE: ShieldCheck, BUILDER: Flag, TEAM: Users } as const

export function PricingPage() {
  return (
    <Section spacing="tight">
      <PricingViewTracker />
      <Container variant="marketing" className="space-y-12 px-4 sm:space-y-14 sm:px-6 lg:space-y-16 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <MarketingEyebrow>{PRICING.label}</MarketingEyebrow>
          <Heading as="h1" className="mt-4 font-display text-balance text-4xl font-bold leading-display tracking-display sm:text-5xl">
            {PRICING.headline}
          </Heading>
          <Body className="mt-5 text-pretty text-muted-foreground sm:text-lg">{PRICING.subhead}</Body>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {PRICING.assurances.map((assurance) => <li key={assurance}>{assurance}</li>)}
          </ul>
        </div>

        <section aria-labelledby="pricing-plans-heading" className="space-y-5">
          <h2 id="pricing-plans-heading" className="sr-only">{PRICING.plansTitle}</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
            {PRICING_CARDS.map((plan) => {
              const Icon = PLAN_ICONS[plan.plan]
              return (
                <article key={plan.plan} aria-labelledby={`pricing-${plan.plan}`} className={cn('flex flex-col gap-6 rounded-card border border-border/65 bg-background p-5 sm:p-6', plan.highlight && 'border-brand bg-brand/[0.03]')}>
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5 text-foreground" aria-hidden />
                    <span className={cn('rounded-full border border-border px-3 py-1 text-xs font-semibold', plan.highlight && 'border-brand/40')}>{plan.badge}</span>
                  </div>
                  <div className="space-y-2">
                    <h3 id={`pricing-${plan.plan}`} className="font-display text-xl font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.persona}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{plan.priceLabel}</p>
                    <div className="flex flex-wrap items-baseline gap-1">
                      <PlanPrice price={plan.price} />
                      {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                    </div>
                  </div>
                  <ul className="flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <PricingCTAButton plan={plan.plan} cta={plan.cta} signUpHref={plan.href as Route} highlight={plan.highlight} waitlistGated />
                </article>
              )
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">{PRICING.studioLine}{' '}<Link href={PRICING.studioHref} className="font-medium text-link underline-offset-4 hover:underline">{PRICING.studioCta}</Link></p>
        </section>

        <section aria-labelledby="pricing-shared-heading" className="rounded-card bg-muted/50 p-5 sm:p-8">
          <Heading as="h2" id="pricing-shared-heading" className="font-display text-2xl font-semibold">{PRICING.sharedTitle}</Heading>
          <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {PRICING.sharedFeatures.map((feature) => <li key={feature} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" aria-hidden />{feature}</li>)}
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{PRICING.sharedNote}</p>
        </section>

        <section aria-labelledby="pricing-comparison-heading" className="space-y-6 scroll-mt-[var(--header-offset)]" id="compare-plans">
          <div className="max-w-2xl space-y-3">
            <MarketingEyebrow>{PRICING.compareLabel}</MarketingEyebrow>
            <Heading as="h2" id="pricing-comparison-heading" className="font-display text-3xl font-semibold tracking-display sm:text-4xl">{PRICING.compareTitle}</Heading>
            <Body className="text-muted-foreground">{PRICING.compareBody}</Body>
          </div>
          <PricingComparisonTable />
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{PRICING.compareNote}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/docs/site-care" className="inline-flex min-h-11 items-center font-medium text-link hover:underline">{PRICING.coverageLink}</Link>
            <Link href="/docs/integrations" className="inline-flex min-h-11 items-center font-medium text-link hover:underline">{PRICING.connectionsLink}</Link>
          </div>
        </section>

        <div className="mx-auto max-w-3xl"><FaqSection items={PRICING_FAQ} title={PRICING.faqTitle} sectionLabel={null} defaultOpenFirst /></div>
      </Container>
    </Section>
  )
}
