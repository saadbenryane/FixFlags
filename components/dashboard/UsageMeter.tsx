'use client'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { UPSELLS } from '@/lib/marketing/copy'
import { checkUsageProgress } from '@/lib/audit/check-limit'
import { planLabel } from '@/lib/billing/plans'

interface Props {
  used: number
  limit: number | null
  pending?: number
  plan: string
  purchasedCredits?: number
}

export function UsageMeter({ used, limit, pending = 0, plan, purchasedCredits = 0 }: Props) {
  const isUnlimited = limit === null || limit === Infinity
  const { atLimit, pct } = checkUsageProgress(used, pending, isUnlimited ? null : limit)
  const nearLimit = !isUnlimited && pct >= 80
  const remaining = !isUnlimited ? Math.max(0, limit - used - pending) : Infinity

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {isUnlimited
              ? `${used} check${used !== 1 ? 's' : ''} this period`
              : `${used + pending} / ${limit} checks`}
          </span>
          {plan !== 'FREE' && !isUnlimited && (
            <span className="text-xs text-muted-foreground">{planLabel(plan)} plan</span>
          )}
        </div>

        {pending > 0 && (
          <p className="text-xs text-muted-foreground">
            {pending} AI report{pending !== 1 ? 's' : ''} in progress
          </p>
        )}

        {purchasedCredits > 0 && (
          <p className="text-xs text-muted-foreground">
            {purchasedCredits} purchased credit{purchasedCredits !== 1 ? 's' : ''} available
          </p>
        )}

        {!isUnlimited && (
          <Progress
            value={pct}
            className={cn(
              atLimit && 'bg-destructive/20 [&>div]:bg-destructive',
              nearLimit && !atLimit && '[&>div]:bg-brand'
            )}
          />
        )}

        {!isUnlimited && plan === 'FREE' && remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            {remaining} check{remaining !== 1 ? 's' : ''} remaining
            {limit > 0 ? ` of ${limit} free checks` : ''}
            {remaining === 1 && (
              <span>
                {' - '}
                <Link href="/pricing" className="text-brand hover:underline">
                  upgrade for unlimited
                </Link>
              </span>
            )}
          </p>
        )}

        {atLimit && plan === 'FREE' && purchasedCredits === 0 && (
          <p className="text-xs text-muted-foreground">
            {UPSELLS.atLimit}{' '}
            <Link href="/pricing" className="text-brand hover:underline">
              Upgrade to Pro
            </Link>
          </p>
        )}

        {atLimit && plan !== 'FREE' && purchasedCredits === 0 && (
          <p className="text-xs text-muted-foreground">
            Plan limit reached.{' '}
            <Link href="/billing#credit-packs" className="text-brand hover:underline">
              Buy +10 audits
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
