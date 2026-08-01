'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics/events'
import { getUpgradeMomentContent, type UpgradeMoment } from '@/lib/billing/upgrade-moments'
import { requestPlanCheckout } from '@/lib/billing/client-checkout'
import { BILLING_ACTION_COPY, PRICING } from '@/lib/marketing/copy'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { BetaInterestForm } from '@/components/billing/BetaInterestForm'
import { isPaidCheckoutGatedClient } from '@/lib/billing/paid-open'

interface Props {
  context?: UpgradeMoment
  /** Target plan for checkout. Defaults to Pro. Use TEAM for Studio. */
  plan?: 'BUILDER' | 'TEAM'
  betaGated?: boolean
  userEmail?: string
}

export function UpgradeButton({
  context,
  plan = 'BUILDER',
  betaGated = isPaidCheckoutGatedClient(),
  userEmail,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [showBetaForm, setShowBetaForm] = useState(false)
  const momentContent = context ? getUpgradeMomentContent(context) : null
  const waitlistCta =
    plan === 'TEAM' ? BILLING_ACTION_COPY.beta.gatedStudioCta : BILLING_ACTION_COPY.beta.gatedProCta

  async function handleUpgrade() {
    if (betaGated) {
      setShowBetaForm(true)
      return
    }

    setLoading(true)
    trackEvent('started_checkout', { plan, is_logged_in: true })
    const outcome = await requestPlanCheckout(plan)
    setLoading(false)

    if (outcome.kind === 'private-beta') {
      setShowBetaForm(true)
      return
    }
    if (outcome.kind === 'redirect') {
      if (outcome.existingSubscription) {
        toast.message(BILLING_ACTION_COPY.checkout.existingTitle, {
          description: BILLING_ACTION_COPY.checkout.existingBody,
        })
      }
      window.location.href = outcome.url
      return
    }
    toast.error(
      outcome.kind === 'unavailable' || outcome.kind === 'error'
        ? outcome.message
        : BILLING_ACTION_COPY.checkout.missingDestination
    )
  }

  if (showBetaForm) {
    return (
      <BetaInterestForm plan={plan} initialEmail={userEmail} compact source="dashboard" />
    )
  }

  return (
    <div className="flex items-center gap-3">
      {momentContent && (
        <span className="text-xs text-muted-foreground max-w-48 text-right leading-snug">
          {momentContent.headline}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleUpgrade}
        loading={loading}
        loadingLabel={PRICING.checkoutRedirecting}
      >
        {!loading && <Sparkles className="h-4 w-4 mr-2" />}
        {betaGated
          ? waitlistCta
          : momentContent
            ? momentContent.cta
            : plan === 'TEAM'
              ? `Upgrade to ${PLAN_DEFINITIONS.TEAM.name}`
              : 'Upgrade'}
      </Button>
    </div>
  )
}
