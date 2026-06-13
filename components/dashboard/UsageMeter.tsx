'use client'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { UPSELLS } from '@/lib/marketing/copy'

interface Props {
  used: number
  limit: number | null
  pending?: number
  plan: string
}

export function UsageMeter({ used, limit, pending = 0, plan }: Props) {
  const isUnlimited = limit === null || limit === Infinity
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit!) * 100))
  const atLimit = !isUnlimited && used >= limit!
  const nearLimit = !isUnlimited && pct >= 80

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {isUnlimited ? `${used} tokens used (unlimited)` : `${used} / ${limit} tokens used`}
        </span>
        {plan !== 'FREE' && !isUnlimited && (
          <span className="text-xs text-muted-foreground capitalize">{plan.toLowerCase()} plan</span>
        )}
      </div>

      {pending > 0 && (
        <p className="text-xs text-muted-foreground">
          {pending} scan{pending !== 1 ? 's' : ''} in progress
        </p>
      )}

      {!isUnlimited && (
        <Progress
          value={pct}
          className={cn(
            'h-2',
            atLimit ? '[&>div]:bg-destructive' : nearLimit ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
          )}
        />
      )}

      {atLimit && (
        <p className="text-xs text-destructive">
          {UPSELLS.atLimit}.{' '}
          <Link href="/pricing" className="underline">Upgrade to continue</Link>
        </p>
      )}
    </div>
  )
}
