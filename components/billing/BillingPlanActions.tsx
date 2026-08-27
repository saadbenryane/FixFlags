'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlanPickerDialog } from '@/components/billing/PlanPickerDialog'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { BILLING_PAGE_COPY } from '@/lib/marketing/copy'

interface Props {
  isPaid: boolean
  isActivating: boolean
  hasStripeCustomer: boolean
  /** When true, show Upgrade plan; when paid and not activating, show Change plan. */
  showPlanPickerCta: boolean
}

export function BillingPlanActions({
  isPaid,
  isActivating,
  hasStripeCustomer,
  showPlanPickerCta,
}: Props) {
  const [open, setOpen] = useState(false)
  const copy = BILLING_PAGE_COPY

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showPlanPickerCta && (
          <Button type="button" onClick={() => setOpen(true)}>
            {isPaid ? copy.changePlanCta : copy.upgradeCta}
          </Button>
        )}
        {hasStripeCustomer && <ManageSubscriptionButton />}
        {isPaid && !hasStripeCustomer && isActivating && (
          <Button disabled variant="outline">
            {copy.activating}
          </Button>
        )}
      </div>
      <PlanPickerDialog
        open={open}
        onOpenChange={setOpen}
        source="billing"
        fallbackPath="/billing"
        lockDismissal={false}
      />
    </>
  )
}
