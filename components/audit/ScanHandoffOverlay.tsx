'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'
import { AUDIT_PROGRESS, BRAND } from '@/lib/marketing/copy'
import { auditHostname } from '@/lib/audit/active-audit'

type Session = { user: { id: string; email?: string | null } } | null

/**
 * Full-viewport progressive report chrome shown immediately after URL submit,
 * while POST /api/checks is still in flight. Collapses on error; replaces to
 * /report/:id on success.
 */
export function ScanHandoffOverlay({
  url,
  session = null,
}: {
  url: string
  session?: Session
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const previous = document.title
    document.title = `${AUDIT_PROGRESS.inProgress.replace(/\.$/, '')} - ${auditHostname(url)} · ${BRAND.name}`
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.title = previous
      document.body.style.overflow = previousOverflow
    }
  }, [url, mounted])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={AUDIT_PROGRESS.inProgress}
    >
      <AuditShell session={session}>
        <AuditReportProgressive status="QUEUED" url={url} />
      </AuditShell>
    </div>,
    document.body
  )
}
