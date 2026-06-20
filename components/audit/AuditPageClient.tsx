'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuditPolling } from '@/hooks/useAuditPolling'
import { useWorkerIdleDetection } from '@/hooks/useWorkerIdleDetection'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { toast } from 'sonner'
import { AUDIT_PROGRESS, BRAND } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import {
  setActiveAudit,
  clearActiveAudit,
  auditHostname,
} from '@/lib/audit/active-audit'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'

interface Props {
  id: string
  initialAudit?: Record<string, unknown> | null
  pollStatus?: boolean
  session?: { user: { id: string } } | null
}

function mergeScreenshots(
  fromStatus?: AuditScreenshot[],
  fromInitial?: unknown
): AuditScreenshot[] {
  if (fromStatus?.length) return fromStatus
  if (Array.isArray(fromInitial)) return fromInitial as AuditScreenshot[]
  return []
}

export function AuditPageClient({ id, initialAudit, pollStatus = true, session }: Props) {
  const router = useRouter()
  const {
    audit,
    isComplete,
    isFailed,
    isNotFound,
    isForbidden,
    fetchError,
    status,
    url,
    statusPayload,
  } = useAuditPolling(id, { initialAudit, pollStatus })
  const workerIdle = useWorkerIdleDetection(status)
  const [retryLoading, setRetryLoading] = useState(false)
  const [limitGate, setLimitGate] = useState<{
    message: string
    code?: string
    action?: string
  } | null>(null)
  const refreshedRef = useRef(false)

  useEffect(() => {
    if (isComplete && !refreshedRef.current) {
      refreshedRef.current = true
      trackEvent('audit_completed', {
        audit_id: id,
        score: typeof audit?.score === 'number' ? audit.score : undefined,
      })
      router.refresh()
    }
  }, [isComplete, router, id, audit?.score])

  const inProgress = !isComplete && !isFailed

  useEffect(() => {
    if (isComplete || isFailed) {
      clearActiveAudit(id)
      return
    }
    const resolvedUrl = url ?? (initialAudit?.url as string | undefined)
    if (inProgress && resolvedUrl) {
      setActiveAudit({ auditId: id, url: resolvedUrl })
    }
  }, [id, inProgress, isComplete, isFailed, url, initialAudit?.url])

  useEffect(() => {
    if (isComplete || isFailed) {
      document.title = BRAND.name
      return
    }
    const resolvedUrl = url ?? (initialAudit?.url as string | undefined)
    if (inProgress && resolvedUrl) {
      document.title = `${AUDIT_PROGRESS.inProgress.replace(/\.$/, '')} - ${auditHostname(resolvedUrl)} · ${BRAND.name}`
    }
    return () => {
      document.title = BRAND.name
    }
  }, [url, inProgress, isComplete, isFailed, initialAudit?.url])

  const progressiveProps = useMemo(() => {
    const resolvedUrl = (statusPayload?.url ?? initialAudit?.url ?? '') as string
    const screenshots = mergeScreenshots(
      statusPayload?.screenshots,
      initialAudit?.screenshots
    )
    const rubrics =
      statusPayload?.rubrics ??
      (Array.isArray(initialAudit?.rubrics)
        ? (initialAudit.rubrics as Array<{
            name: string
            grade: string | null
            score: number | null
          }>)
        : [])

    return {
      status,
      url: resolvedUrl,
      pageType: statusPayload?.pageType ?? (initialAudit?.pageType as string | null) ?? null,
      verdict: statusPayload?.verdict ?? (initialAudit?.verdict as string | null) ?? null,
      score: statusPayload?.score ?? (initialAudit?.score as number | null) ?? null,
      flagCount: statusPayload?.flagCount ?? 0,
      shareStatus: statusPayload?.shareStatus,
      rubrics,
      partialFlags: statusPayload?.partialFlags ?? [],
      screenshots,
      screenshotCapture: statusPayload?.screenshotCapture,
      workerIdle,
    }
  }, [status, statusPayload, initialAudit, workerIdle])

  async function handleRetrySameAudit() {
    setRetryLoading(true)
    setLimitGate(null)
    try {
      const res = await fetch(`/api/audits/${id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (res.status === 402) {
          setLimitGate(parsed)
        } else {
          toast.error(parsed.message)
        }
        return
      }
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setRetryLoading(false)
    }
  }

  if (isNotFound) {
    return (
      <AuditShell session={session}>
        <Container variant="report" className="space-y-4 py-24 text-center">
          <h2 className="text-xl font-semibold">Report not found</h2>
          <p className="text-muted-foreground text-sm">This report does not exist or has been removed.</p>
          <Button asChild>
            <Link href="/">Check My Site</Link>
          </Button>
        </Container>
      </AuditShell>
    )
  }

  if (isForbidden) {
    return (
      <AuditShell session={session}>
        <Container variant="report" className="space-y-4 py-24 text-center">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-muted-foreground text-sm">{fetchError || 'You do not have access to this report.'}</p>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </Container>
      </AuditShell>
    )
  }

  if (isFailed) {
    const errorMsg =
      (audit?.errorMsg as string | undefined) ??
      (initialAudit?.errorMsg as string | undefined) ??
      statusPayload?.errorMsg

    return (
      <AuditShell session={session}>
        <Container variant="report" className="mx-auto max-w-lg space-y-4 py-24 text-center">
          <AuditFailurePanel
            errorMsg={errorMsg}
            failureCode={statusPayload?.failureCode}
            onRetry={handleRetrySameAudit}
            retryLoading={retryLoading}
          />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Check another site</Link>
          </Button>
          {limitGate && (
            <AuditLimitGate
              message={limitGate.message}
              code={limitGate.code}
              action={limitGate.action}
              onDismiss={() => setLimitGate(null)}
            />
          )}
        </Container>
      </AuditShell>
    )
  }

  if (inProgress) {
    return (
      <AuditShell session={session}>
        <AuditReportProgressive {...progressiveProps} />
      </AuditShell>
    )
  }

  return null
}
