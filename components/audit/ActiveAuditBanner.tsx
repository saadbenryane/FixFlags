'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { useActiveAudit } from '@/hooks/useActiveAudit'
import { auditHostname } from '@/lib/audit/active-audit'

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000))
}

function formatWait(seconds: number): string {
  if (seconds <= 0) return 'starting soon'
  if (seconds < 60) return `~${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`
}

export function ActiveAuditBanner() {
  const { active } = useActiveAudit()
  const pathname = usePathname()
  const [waitLabel, setWaitLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      setWaitLabel(null)
      return
    }

    if (active.scheduledStartAt) {
      const update = () => setWaitLabel(formatWait(secondsUntil(active.scheduledStartAt!)))
      update()
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    }

    if (active.estimatedWaitSeconds && active.estimatedWaitSeconds > 0) {
      setWaitLabel(formatWait(active.estimatedWaitSeconds))
      return
    }

    setWaitLabel(null)
  }, [active?.scheduledStartAt, active?.estimatedWaitSeconds, active])

  if (!active) return null
  if (pathname === `/audit/${active.auditId}`) return null

  const hostname = auditHostname(active.url)
  const isQueued = active.queueReason != null || (active.estimatedWaitSeconds ?? 0) > 0

  return (
    <div className="pointer-events-none px-3 pb-2 pt-0">
      <Container className="pointer-events-auto">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full glass-surface-elevated px-4 py-2 text-xs text-muted-foreground shadow-raised">
          {isQueued ? (
            <Clock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
          ) : (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
          )}
          <span>
            {isQueued ? 'Audit queued for' : 'Audit running for'}{' '}
            <span className="font-medium text-foreground">{hostname}</span>
            {waitLabel ? ` - ${waitLabel}` : null}
          </span>
          <Link
            href={`/report/${active.auditId}`}
            className="font-medium text-brand transition-colors duration-200 hover:text-brand/80"
          >
            Return to audit
          </Link>
        </div>
      </Container>
    </div>
  )
}
