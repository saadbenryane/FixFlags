'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics/events'
import { getUpgradeMomentContent, type UpgradeMoment } from '@/lib/billing/upgrade-moments'
import { requestPlanCheckout } from '@/lib/billing/client-checkout'
import { BILLING_ACTION_COPY, PRICING } from '@/lib/marketing/copy'
import { BetaInterestForm } from '@/components/billing/BetaInterestForm'

interface Props {
  context?: UpgradeMoment
  /** Target plan for checkout. Defaults to Pro. Use TEAM for Studio. */
  plan?: 'BUILDER' | 'TEAM'
  betaGated?: boolean
  userEmail?: string
}

export function UpgradeButton({ context, plan = 'BUILDER', betaGated, userEmail }: Props) {
  const [loading, setLoading] = useState(false)
  const [showBetaForm, setShowBetaForm] = useState(false)
  const momentContent = context ? getUpgradeMomentContent(context) : null

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
    return <BetaInterestForm plan={plan} initialEmail={userEmail} compact />
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
          ? `Join ${plan === 'TEAM' ? 'Studio' : 'Pro'} beta`
          : momentContent
            ? momentContent.cta
            : plan === 'TEAM'
              ? 'Upgrade to Studio'
              : 'Upgrade'}
      </Button>
    </div>
  )
}
