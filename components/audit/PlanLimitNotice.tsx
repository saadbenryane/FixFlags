'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { PLAN_LIMIT_NOTICE, type PlanLimitKind } from '@/lib/marketing/copy'

export interface PlanLimitNoticeProps {
  /** Which plan boundary was reached. Selects the explanation. */
  kind: PlanLimitKind
  /**
   * Optional detail from the API that states the concrete capacity reached, for
   * example how many websites the plan includes. Only pass a customer-safe
   * sentence; the notice supplies the explanation either way.
   */
  message?: string
  onDismiss?: () => void
}

/**
 * The one surface for a plan limit. Every path that can stop a customer (a new
 * analysis, a spent period allowance, a Site that could not be saved) lands here
 * so the explanation and the single next step stay identical.
 */
export function PlanLimitNotice({ kind, message, onDismiss }: PlanLimitNoticeProps) {
  const copy = PLAN_LIMIT_NOTICE.copy[kind]

  return (
    <Callout variant="warning" title={copy.title}>
      <div className="space-y-3">
        <p>{copy.body}</p>
        {message ? <p className="text-muted-foreground">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="brand" size="sm">
            <Link href="/pricing">{PLAN_LIMIT_NOTICE.upgradeCta}</Link>
          </Button>
          {onDismiss ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              {PLAN_LIMIT_NOTICE.dismissCta}
            </Button>
          ) : null}
        </div>
      </div>
    </Callout>
  )
}
