'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import {
  getUpgradeMomentContent,
  type UpgradeMoment,
} from '@/lib/billing/upgrade-moments'

interface Props {
  moment: UpgradeMoment
  scoreDelta?: number
  isLoggedIn?: boolean
  currentPlan?: string
  /** When set, primary action is a link instead of checkout */
  primaryHref?: string
  /** When false, omit the CTA button (info-only banner) */
  showCta?: boolean
  className?: string
}

export function ContextualUpgradeCard({
  moment,
  scoreDelta,
  isLoggedIn = true,
  currentPlan = 'FREE',
  primaryHref,
  showCta = true,
  className,
}: Props) {
  const content = getUpgradeMomentContent(moment, { scoreDelta })
  const signUpHref =
    content.plan === 'TEAM' ? '/sign-up?plan=TEAM' : '/sign-up?plan=BUILDER'

  return (
    <div
      className={`surface-raised rounded-xl p-6 text-center space-y-3 shadow-card ${className ?? ''}`}
    >
      <h3 className="font-semibold">{content.headline}</h3>
      <p className="text-sm text-muted-foreground">{content.body}</p>
      {showCta && (
        primaryHref ? (
          <Button asChild>
            <Link href={primaryHref}>{content.cta}</Link>
          </Button>
        ) : (
          <div className="flex justify-center">
            <PricingCTAButton
              plan={content.plan}
              cta={content.cta}
              signUpHref={signUpHref}
              highlight
              isLoggedIn={isLoggedIn}
              currentPlan={currentPlan}
            />
          </div>
        )
      )}
    </div>
  )
}
