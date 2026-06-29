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
import {
  ReportAccessDeniedStatus,
  ReportNotFoundStatus,
  ReportPollErrorStatus,
} from '@/components/ui/status-page'
import { toast } from 'sonner'
import { AUDIT_ERRORS, AUDIT_PROGRESS, BRAND } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
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

function isAuditScreenshot(val: unknown): val is AuditScreenshot {
  return typeof val === 'object' && val !== null && (val as Record<string, unknown>).device in { DESKTOP: 1, MOBILE: 1 }
}

function mergeScreenshots(
  fromStatus?: AuditScreenshot[],
  fromInitial?: unknown
): AuditScreenshot[] {
  if (fromStatus?.length) return fromStatus
  if (Array.isArray(fromInitial)) return fromInitial.filter(isAuditScreenshot)
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
    error: pollError,
    isLoading,
    status,
    url,
    statusPayload,
  } = useAuditPolling(id, { initialAudit, pollStatus })
  const workerIdle = useWorkerIdleDetection(status)
  const [retryLoading, setRetryLoading] = useState(false)
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
    const resolvedUrl = url ?? (typeof initialAudit?.url === 'string' ? initialAudit.url : undefined)
    if (inProgress && resolvedUrl) {
      setActiveAudit({ auditId: id, url: resolvedUrl })
    }
  }, [id, inProgress, isComplete, isFailed, url, initialAudit?.url])

  useEffect(() => {
    if (isComplete || isFailed) {
      document.title = BRAND.name
      return
    }
    const resolvedUrl = url ?? (typeof initialAudit?.url === 'string' ? initialAudit.url : undefined)
    if (inProgress && resolvedUrl) {
      document.title = `${AUDIT_PROGRESS.inProgress.replace(/\.$/, '')} - ${auditHostname(resolvedUrl)} · ${BRAND.name}`
    }
    return () => {
      document.title = BRAND.name
    }
  }, [url, inProgress, isComplete, isFailed, initialAudit?.url])

  const progressiveProps = useMemo(() => {
    const raw = initialAudit as Record<string, unknown> | null
    const resolvedUrl = typeof statusPayload?.url === 'string'
      ? statusPayload.url
      : typeof raw?.url === 'string'
        ? raw.url
        : ''
    const screenshots = mergeScreenshots(
      statusPayload?.screenshots,
      raw?.screenshots
    )
    const rawRubrics = statusPayload?.rubrics ?? raw?.rubrics
    const rubrics = Array.isArray(rawRubrics)
      ? rawRubrics.filter(
          (r): r is { name: string; grade: string | null; score: number | null } =>
            typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>).name === 'string'
        )
      : []

    return {
      status,
      url: resolvedUrl,
      pageType: typeof statusPayload?.pageType === 'string'
        ? statusPayload.pageType
        : typeof raw?.pageType === 'string'
          ? raw.pageType
          : null,
      verdict: typeof statusPayload?.verdict === 'string'
        ? statusPayload.verdict
        : typeof raw?.verdict === 'string'
          ? raw.verdict
          : null,
      score: typeof statusPayload?.score === 'number'
        ? statusPayload.score
        : typeof raw?.score === 'number'
          ? raw.score
          : null,
      flagCount: statusPayload?.flagCount ?? 0,
      rubrics,
      partialFlags: statusPayload?.partialFlags ?? [],
      screenshots,
      screenshotCapture: statusPayload?.screenshotCapture,
      workerIdle,
    }
  }, [status, statusPayload, initialAudit, workerIdle])

  async function handleRetrySameAudit() {
    setRetryLoading(true)
    try {
      const res = await fetch(`/api/audits/${id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        toast.error(parsed.message)
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
        <ReportNotFoundStatus />
      </AuditShell>
    )
  }

  if (isForbidden) {
    return (
      <AuditShell session={session}>
        <ReportAccessDeniedStatus description={fetchError ?? undefined} />
      </AuditShell>
    )
  }

  const hasPollError = Boolean(pollError) && !isLoading && !isComplete && !isFailed

  if (hasPollError) {
    return (
      <AuditShell session={session}>
        <ReportPollErrorStatus onRetry={() => router.refresh()} />
      </AuditShell>
    )
  }

  if (isFailed) {
    return (
      <AuditShell session={session}>
        <Container variant="report" className="mx-auto max-w-lg space-y-4 py-24 text-center">
          <AuditFailurePanel
            failureCode={statusPayload?.failureCode}
            onRetry={handleRetrySameAudit}
            retryLoading={retryLoading}
          />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">{AUDIT_ERRORS.checkAnotherSite}</Link>
          </Button>
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
