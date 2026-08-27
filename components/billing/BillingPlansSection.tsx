'use client'

import { useState } from 'react'
import { CheckCircle2, ShieldCheck, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Heading, Muted, SectionTitle } from '@/components/ui/typography'
import { PlanPickerDialog } from '@/components/billing/PlanPickerDialog'
import { BILLING_PAGE_COPY, PLANS, PRICING } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const PLAN_ICONS = {
  FREE: ShieldCheck,
  BUILDER: Zap,
  TEAM: Users,
} as const

interface Props {
  currentPlan: string
}

export function BillingPlansSection({ currentPlan }: Props) {
  const [open, setOpen] = useState(false)
  const copy = BILLING_PAGE_COPY

  return (
    <section className="space-y-4" aria-labelledby="billing-plans-heading">
      <div className="space-y-1">
        <SectionTitle id="billing-plans-heading">{copy.plansTitle}</SectionTitle>
        <Muted className="text-sm">{copy.plansDescription}</Muted>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const Icon = PLAN_ICONS[plan.plan]
          const isCurrent = currentPlan === plan.plan
          return (
            <Card
              key={plan.plan}
              variant="subtle"
              className={cn(
                'relative flex flex-col gap-4 p-5',
                plan.highlight && !isCurrent && 'ring-1 ring-brand/25',
                isCurrent && 'ring-1 ring-foreground/15',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-muted/70 text-foreground',
                    plan.highlight && 'bg-brand/10 text-brand',
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                {isCurrent ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-2xs font-medium text-muted-foreground">
                    {copy.currentPlanBadge}
                  </span>
                ) : plan.highlight ? (
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-2xs font-semibold text-brand">
                    {PRICING.pickerRecommended}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                <Heading as="h3" className="text-base">
                  {plan.name}
                </Heading>
                <p className="text-xs text-muted-foreground">{plan.persona}</p>
              </div>

              <div>
                <div className="flex items-end gap-1">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-display">
                    {plan.price}
                  </span>
                  {plan.period ? (
                    <span className="pb-0.5 text-xs text-muted-foreground">{plan.period}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{plan.audits}</p>
              </div>

              <ul className="flex-1 space-y-1.5 text-xs leading-snug text-muted-foreground">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <CheckCircle2
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0',
                        plan.highlight ? 'text-brand' : 'text-muted-foreground/80',
                      )}
                      aria-hidden
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button variant="outline" disabled className="w-full">
                  {PRICING.pickerCurrentPlan}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setOpen(true)}
                >
                  {plan.plan === 'FREE'
                    ? PRICING.pickerFreeCta
                    : plan.plan === 'BUILDER'
                      ? copy.upgradeCta
                      : PRICING.pickerStudioCta}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      <PlanPickerDialog
        open={open}
        onOpenChange={setOpen}
        source="billing"
        fallbackPath="/billing"
        lockDismissal={false}
      />
    </section>
  )
}
