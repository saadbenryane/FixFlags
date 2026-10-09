'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlanPickerDialog } from '@/components/billing/PlanPickerDialog'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { BILLING_PAGE_COPY } from '@/lib/marketing/copy'

interface Props {
  isPaid: boolean
  hasStripeCustomer: boolean
}

export function BillingPlanActions({
  isPaid,
  hasStripeCustomer,
}: Props) {
  const [open, setOpen] = useState(false)
  const copy = BILLING_PAGE_COPY

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setOpen(true)}>
          {isPaid ? copy.changePlanCta : copy.upgradeCta}
        </Button>
        {hasStripeCustomer && <ManageSubscriptionButton />}
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
