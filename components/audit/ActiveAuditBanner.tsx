'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { useActiveAudit } from '@/hooks/useActiveAudit'
import { auditHostname, clearActiveAudit } from '@/lib/audit/active-audit'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

export function ActiveAuditBanner() {
  const { active } = useActiveAudit()
  const pathname = usePathname()
  const [stillRunning, setStillRunning] = useState(true)

  useEffect(() => {
    if (!active) return
    if (pathname === `/report/${active.auditId}`) {
      setStillRunning(false)
      return
    }
    let cancelled = false
    fetch(`/api/reports/${active.auditId}/status`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          // Status endpoint gone or unauthorized: clear stuck banner.
          clearActiveAudit(active.auditId)
          setStillRunning(false)
          return
        }
        const data = (await res.json()) as { status?: string }
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearActiveAudit(active.auditId)
          setStillRunning(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        clearActiveAudit(active.auditId)
        setStillRunning(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, pathname])

  if (!active || !stillRunning) return null

  const hostname = auditHostname(active.url)

  return (
    <div className="pointer-events-none px-3 pb-2 pt-0">
      <Container className="pointer-events-auto">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full glass-surface-elevated px-4 py-2 text-xs text-muted-foreground shadow-raised">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
          <span>
            {AUDIT_PROGRESS.bannerScanning}{' '}
            <span className="font-medium text-foreground">{hostname}</span>
          </span>
          <Link
            href={`/report/${active.auditId}`}
            className="font-medium text-brand transition-colors duration-200 hover:text-brand/80"
          >
            Return to report
          </Link>
        </div>
      </Container>
    </div>
  )
}
