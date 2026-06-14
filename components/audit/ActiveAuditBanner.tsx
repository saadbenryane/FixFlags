'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import { useActiveAudit } from '@/hooks/useActiveAudit'
import { auditHostname } from '@/lib/audit/active-audit'

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000))
}

function formatWait(seconds: number): string {
  if (seconds <= 0) return 'starting soon'
  if (seconds < 60) return `~${seconds}s`
  const mins = Math.floor(seconds / 60)
  return `~${mins}m`
}

export function ActiveAuditBanner() {
  const { active } = useActiveAudit()
  const pathname = usePathname()
  const [waitLabel, setWaitLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!active?.scheduledStartAt) {
      setWaitLabel(null)
      return
    }
    const update = () => {
      const secs = secondsUntil(active.scheduledStartAt!)
      setWaitLabel(formatWait(secs))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [active?.scheduledStartAt])

  if (!active) return null
  if (pathname === `/audit/${active.auditId}`) return null

  const hostname = auditHostname(active.url)
  const isQueued = active.queueReason != null || (active.estimatedWaitSeconds ?? 0) > 0

  return (
    <div className="border-b bg-brand/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-xs text-muted-foreground">
        {isQueued ? (
          <Clock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
        )}
        <span>
          {isQueued ? 'Audit queued for' : 'Audit running for'}{' '}
          <span className="font-medium text-foreground">{hostname}</span>
          {waitLabel ? ` — ${waitLabel}` : null}
        </span>
        <Link
          href={`/audit/${active.auditId}`}
          className="font-medium text-brand link-underline-grow"
        >
          Return to audit
        </Link>
      </div>
    </div>
  )
}
