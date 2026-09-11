import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Flag, ShieldCheck } from 'lucide-react'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { PlanPrice } from '@/components/pricing/PlanPrice'
import { PricingViewTracker } from '@/components/pricing/PricingViewTracker'
import { MarketingCompareSection } from '@/components/marketing/MarketingCompareSection'
import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { PRICING, PRICING_CARDS, PRICING_FAQ } from '@/lib/marketing/copy/plans'
import { cn } from '@/lib/utils'

const PLAN_ICONS = {
  FREE: ShieldCheck,
  BUILDER: Flag,
} as const

export function PricingPage() {
  return (
    <Section spacing="tight" className="relative overflow-hidden">
      <PricingViewTracker />
      <Container
        variant="marketing"
        className="space-y-12 px-4 sm:space-y-14 sm:px-6 lg:space-y-16 lg:px-12"
      >
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] lg:gap-10">
          <div className="max-w-3xl">
            <MarketingEyebrow>{PRICING.label}</MarketingEyebrow>
            <Heading
              as="h1"
              className="mt-4 max-w-[18ch] font-display text-balance text-4xl font-bold leading-display tracking-display sm:text-5xl"
            >
              {PRICING.headline}
            </Heading>
            <Body className="mt-5 max-w-2xl text-muted-foreground text-pretty sm:text-lg">
              {PRICING.subhead}
            </Body>

            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {PRICING.assurances.map((assurance) => (
                <li key={assurance}>{assurance}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[29rem] lg:block">
            <Image
              src="/marketing/visuals/pricing-glass-mark.webp"
              alt=""
              width={1448}
              height={1086}
              priority
              sizes="(min-width: 1280px) 34rem, 28rem"
              className="relative h-auto w-full select-none object-contain mix-blend-multiply [-webkit-mask-image:radial-gradient(ellipse_at_center,black_56%,transparent_83%)] [mask-image:radial-gradient(ellipse_at_center,black_56%,transparent_83%)]"
              draggable={false}
            />
          </div>
        </div>

        <h2 className="sr-only">Plans</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {PRICING_CARDS.map((plan) => {
            const PlanIcon = PLAN_ICONS[plan.plan]
            return (
              <article
                key={plan.name}
                className={cn(
                  'relative flex h-full min-h-[31rem] flex-col overflow-hidden rounded-[13px] border border-border/65 bg-background',
                  plan.highlight && 'border-brand',
                )}
              >
                <div className="space-y-4 p-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={cn(
                        'inline-flex h-11 w-11 items-center justify-center rounded-[10px] bg-muted/70 text-foreground',
                        plan.highlight && 'bg-brand/10 text-brand',
                      )}
                    >
                      <PlanIcon
                        className="h-5 w-5"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </span>
                    {plan.badge ? (
                      <span className="rounded-full border border-brand/40 px-2.5 py-1 text-xs font-semibold text-foreground">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-tight">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.persona}
                    </p>
                  </div>

                  <p className="text-sm font-medium leading-snug text-pretty">
                    {plan.outcome}
                  </p>

                  <div>
                    <div className="flex items-end gap-1">
                      <PlanPrice price={plan.price} />
                      {plan.period ? (
                        <span className="pb-1 text-sm text-muted-foreground">
                          {plan.period}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {plan.audits}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                  <ul className="flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm leading-snug"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-foreground"
                          aria-hidden
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <PricingCTAButton
                    plan={plan.plan}
                    cta={plan.cta}
                    signUpHref={plan.href as Route}
                    highlight={plan.highlight}
                  />
                </div>
              </article>
            )
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          {PRICING.studioLine}{' '}
          <Link href={PRICING.studioHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            {PRICING.studioCta}
          </Link>
        </p>

        <MarketingCompareSection embedded />

        <div className="mx-auto max-w-3xl">
          <FaqSection
            items={PRICING_FAQ}
            title={PRICING.faqTitle}
            sectionLabel={null}
            defaultOpenFirst
          />
        </div>
      </Container>
    </Section>
  )
}
