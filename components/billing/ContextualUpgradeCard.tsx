'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import {
  getUpgradeMomentContent,
  type UpgradeMoment,
} from '@/lib/billing/upgrade-moments'
import { cn } from '@/lib/utils'

interface Props {
  moment: UpgradeMoment
  scoreDelta?: number
  isLoggedIn?: boolean
  currentPlan?: string
  primaryHref?: string
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
    <Card className={cn('space-y-3 p-6 text-center', className)}>
      <CardTitle>{content.headline}</CardTitle>
      <p className="text-sm text-muted-foreground">{content.body}</p>
      {showCta &&
        (primaryHref ? (
          <Button asChild>
            <Link href={primaryHref as Route}>{content.cta}</Link>
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
        ))}
    </Card>
  )
}
