'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { Container } from '@/components/ui/container'
import { AUDIT_PROGRESS, BRAND } from '@/lib/marketing/copy'
import { auditHostname, setScanHandoffOpen } from '@/lib/audit/active-audit'
import {
  closeScanHandoff,
  useScanHandoffState,
} from '@/lib/audit/scan-handoff-store'
import { useMe } from '@/hooks/useMe'

/**
 * App-wide progressive handoff chrome. Opened by AuditInput / re-check / scan-deeper
 * via scan-handoff-store while create requests run.
 */
export function ScanHandoffHost() {
  const { url, limitGate } = useScanHandoffState()
  const { user } = useMe()
  const pathname = usePathname()
  const open = Boolean(url)

  useEffect(() => {
    setScanHandoffOpen(open)
    return () => setScanHandoffOpen(false)
  }, [open])

  // Drop overlay once the real report route has taken over.
  useEffect(() => {
    if (url && pathname?.startsWith('/report/')) {
      closeScanHandoff()
    }
  }, [pathname, url])

  useEffect(() => {
    if (!url || limitGate) return
    const previous = document.title
    document.title = `${AUDIT_PROGRESS.inProgress.replace(/\.$/, '')} - ${auditHostname(url)} · ${BRAND.name}`
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.title = previous
      document.body.style.overflow = previousOverflow
    }
  }, [url, limitGate])

  if (!url || typeof document === 'undefined') return null

  const session = user
    ? { user: { id: user.id, email: user.email ?? null } }
    : null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-background"
      role="status"
      aria-live="polite"
      aria-busy={!limitGate}
      aria-label={limitGate ? limitGate.message : AUDIT_PROGRESS.inProgress}
    >
      <AuditShell session={session}>
        {limitGate ? (
          <Container variant="report" className="space-y-6 py-10 sm:py-16">
            <AuditReportProgressive status="QUEUED" url={url} />
            <div className="mx-auto max-w-xl">
              <AuditLimitGate
                message={limitGate.message}
                code={limitGate.code}
                action={limitGate.action}
                nextPath={limitGate.nextPath}
                from={limitGate.from}
                onDismiss={() => closeScanHandoff()}
              />
            </div>
          </Container>
        ) : (
          <AuditReportProgressive status="QUEUED" url={url} />
        )}
      </AuditShell>
    </div>,
    document.body
  )
}
