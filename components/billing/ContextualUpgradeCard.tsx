'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { HelpSupportActions } from '@/components/help/HelpSupportActions'
import {
  getUpgradeMomentContent,
  type UpgradeMoment,
} from '@/lib/billing/upgrade-moments'
import { helpHrefForLimitAction, helpHrefForSurface } from '@/lib/help/contextual'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import { cn } from '@/lib/utils'

interface Props {
  moment: UpgradeMoment
  scoreDelta?: number
  isLoggedIn?: boolean
  currentPlan?: string
  primaryHref?: string
  showCta?: boolean
  className?: string
  userEmail?: string
  auditId?: string
  helpHref?: Route
}

function resolveHelpHref(moment: UpgradeMoment, helpHref?: Route): Route {
  if (helpHref) return helpHref
  if (moment === 'audit_limit_reached') {
    return helpHrefForSurface('audit_limit')
  }
  return helpHrefForLimitAction('upgrade')
}

export function ContextualUpgradeCard({
  moment,
  scoreDelta,
  isLoggedIn = true,
  currentPlan = 'FREE',
  primaryHref,
  showCta = true,
  className,
  userEmail,
  auditId,
  helpHref,
}: Props) {
  const content = getUpgradeMomentContent(moment, { scoreDelta })
  const signUpHref =
    content.plan === 'TEAM' ? '/sign-up?plan=TEAM' : '/sign-up?plan=BUILDER'
  const resolvedHelpHref = resolveHelpHref(moment, helpHref)

  useOneShotEvent(
    'audit_limit_reached',
    auditId ?? 'dashboard-limit',
    () => (moment === 'audit_limit_reached' ? { reason: 'monthly_quota' } : null),
    [moment, auditId],
  )

  useOneShotEvent(
    'report_upgrade_gate_viewed',
    auditId ?? moment,
    () =>
      moment !== 'audit_limit_reached' && moment !== 'free_default'
        ? auditId
          ? { audit_id: auditId }
          : {}
        : null,
    [moment, auditId],
  )

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
              userEmail={userEmail}
            />
          </div>
        ))}
      <HelpSupportActions helpHref={resolvedHelpHref} className="justify-center pt-1" />
    </Card>
  )
}
