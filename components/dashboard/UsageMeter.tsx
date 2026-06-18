'use client'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { UPSELLS } from '@/lib/marketing/copy'
import { checkUsageProgress } from '@/lib/audit/check-limit'

interface Props {
  used: number
  limit: number | null
  pending?: number
  plan: string
}

export function UsageMeter({ used, limit, pending = 0, plan }: Props) {
  const isUnlimited = limit === null || limit === Infinity
  const { atLimit, pct } = checkUsageProgress(used, pending, isUnlimited ? null : limit)
  const nearLimit = !isUnlimited && pct >= 80

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {isUnlimited
              ? `${used} AI reports used (unlimited)`
              : `${used + pending} / ${limit} AI reports reserved`}
          </span>
          {plan !== 'FREE' && !isUnlimited && (
            <span className="text-xs text-muted-foreground capitalize">{plan.toLowerCase()} plan</span>
          )}
        </div>

        {pending > 0 && (
          <p className="text-xs text-muted-foreground">
            {pending} AI report{pending !== 1 ? 's' : ''} in progress
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

        {atLimit && plan === 'FREE' && (
          <p className="text-xs text-muted-foreground">
            {UPSELLS.atLimit}{' '}
            <Link href="/pricing" className="text-brand hover:underline">
              Upgrade to Pro
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
