'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { useActiveAudit } from '@/hooks/useActiveAudit'
import { auditHostname } from '@/lib/audit/active-audit'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])
const POLL_DELAYS_MS = [2_000, 4_000, 8_000, 15_000] as const

export function ActiveAuditBanner() {
  const { active, dismiss } = useActiveAudit()
  const pathname = usePathname()
  const [stillRunning, setStillRunning] = useState(true)
  const [hostname, setHostname] = useState<string | null>(null)
  const isActiveReport = Boolean(active && pathname === `/report/${active.auditId}`)

  useEffect(() => {
    if (!active) {
      setStillRunning(false)
      return
    }
    if (isActiveReport) {
      setStillRunning(false)
      return
    }
    setHostname(null)
    setStillRunning(true)
    const activeAudit = active
    let cancelled = false
    let attempt = 0
    let timeout: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    async function poll() {
      controller = new AbortController()
      try {
        const response = await fetch(`/api/reports/${activeAudit.auditId}/status`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (cancelled) return
        if ([401, 403, 404, 410].includes(response.status)) {
          dismiss(activeAudit.auditId)
          setStillRunning(false)
          return
        }
        if (response.ok) {
          const data = await response.json() as { status?: string; url?: string }
          if (typeof data.url === 'string') setHostname(auditHostname(data.url))
          if (data.status && TERMINAL_STATUSES.has(data.status)) {
            dismiss(activeAudit.auditId)
            setStillRunning(false)
            return
          }
        }
      } catch {
        if (cancelled) return
      }
      const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)]
      attempt += 1
      timeout = setTimeout(poll, delay)
    }
    void poll()
    return () => {
      cancelled = true
      controller?.abort()
      if (timeout) clearTimeout(timeout)
    }
  }, [active, dismiss, isActiveReport])

  if (!active || !stillRunning || isActiveReport) return null

  return (
    <div className="pointer-events-none px-3 pb-2 pt-0">
      <Container className="pointer-events-auto">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full glass-surface-elevated px-4 py-2 text-xs text-muted-foreground shadow-raised">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
          <span>
            {AUDIT_PROGRESS.bannerScanning}{' '}
            <span className="font-medium text-foreground">{hostname ?? 'your page'}</span>
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
