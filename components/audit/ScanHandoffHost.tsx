'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { Logo } from '@/components/brand/Logo'
import { Container } from '@/components/ui/container'
import {
  AUDIT_PROGRESS,
  BRAND,
  formatQueuePosition,
  formatQueueWaitHint,
} from '@/lib/marketing/copy'
import { auditHostname, setScanHandoffOpen } from '@/lib/audit/active-audit'
import {
  closeScanHandoff,
  useScanHandoffState,
} from '@/lib/audit/scan-handoff-store'

/**
 * App-wide progressive handoff chrome. Opened by AuditInput / re-check / scan-deeper
 * via scan-handoff-store while create requests run.
 */
export function ScanHandoffHost() {
  const { url, limitGate, estimatedWaitSeconds, queuePosition } =
    useScanHandoffState()
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

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid overflow-y-auto bg-background"
      role="status"
      aria-live="polite"
      aria-busy={!limitGate}
      aria-label={limitGate ? limitGate.message : AUDIT_PROGRESS.inProgress}
    >
      <Container
        variant="report"
        className="flex min-h-dvh flex-col items-center justify-center gap-8 py-10 text-center"
      >
        <Logo size="lg" />
        {limitGate ? (
          <div className="w-full max-w-xl">
            <AuditLimitGate
              message={limitGate.message}
              code={limitGate.code}
              action={limitGate.action}
              nextPath={limitGate.nextPath}
              from={limitGate.from}
              onDismiss={() => closeScanHandoff()}
            />
          </div>
        ) : (
          <div className="w-full max-w-md space-y-5">
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand"
              aria-hidden
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-brand">
                {AUDIT_PROGRESS.bannerScanning}
              </p>
              <h1 className="text-2xl font-semibold tracking-heading text-foreground sm:text-3xl">
                {auditHostname(url)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {AUDIT_PROGRESS.stages[0].subtitle}
              </p>
              {typeof estimatedWaitSeconds === 'number' &&
              estimatedWaitSeconds > 5 ? (
                <p className="text-xs text-muted-foreground">
                  {formatQueueWaitHint(estimatedWaitSeconds)}
                  {typeof queuePosition === 'number' && queuePosition > 0
                    ? ` ${formatQueuePosition(queuePosition)}`
                    : ''}
                </p>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[8%] rounded-full bg-brand motion-safe:animate-pulse" />
            </div>
          </div>
        )}
      </Container>
    </div>,
    document.body
  )
}
