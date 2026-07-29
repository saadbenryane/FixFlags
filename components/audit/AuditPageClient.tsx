'use client'
import { Component, useState, useEffect, useRef, useMemo, type ErrorInfo, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuditPolling, type AuditStatusPayload } from '@/hooks/useAuditPolling'
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
import { AUDIT_ERRORS, AUDIT_PROGRESS, BRAND, SYSTEM_COPY } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import {
  setActiveAudit,
  clearActiveAudit,
  auditHostname,
} from '@/lib/audit/active-audit'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { Heading, Muted } from '@/components/ui/typography'
import { ReportAuthGate } from '@/components/auth/ReportAuthGate'

/** Catches crashes in the progressive report view so the page doesn't go white. */
class ProgressiveErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(JSON.stringify({ level: 'error', event: 'ui.progressive.error', digest: (error as Error & { digest?: string }).digest, component: info.componentStack?.split('\n')[1]?.trim() }))
  }
  render() {
    if (this.state.hasError) {
      return (
        <Container variant="report" className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <Heading as="h1">Something went wrong during scanning</Heading>
          <Muted className="mt-2 max-w-md">The scan encountered an unexpected error. Try again.</Muted>
          <div className="mt-8">
            <Button onClick={() => { this.setState({ hasError: false }); this.props.onRetry() }}>Try again</Button>
          </div>
        </Container>
      )
    }
    return this.props.children
  }
}

interface Props {
  id: string
  initialAudit?: Record<string, unknown> | null
  pollStatus?: boolean
  session?: { user: { id: string } } | null
  requireAuthGate?: boolean
  atAuditLimit?: boolean
}

type PartialFlag = NonNullable<AuditStatusPayload['partialFlags']>[number]

function isAuditScreenshot(val: unknown): val is AuditScreenshot {
  return val !== null && typeof val === 'object' && 'device' in val
}

function mergeScreenshots(
  fromStatus?: AuditScreenshot[],
  fromInitial?: unknown
): AuditScreenshot[] {
  if (fromStatus?.length) return fromStatus
  if (Array.isArray(fromInitial)) return fromInitial.filter(isAuditScreenshot)
  return []
}

export function AuditPageClient({
  id,
  initialAudit,
  pollStatus = true,
  session,
  requireAuthGate = false,
  atAuditLimit: _atAuditLimit = false,
}: Props) {
  void _atAuditLimit
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
    progress,
    url,
    statusPayload,
  } = useAuditPolling(id, { initialAudit, pollStatus })
  const workerIdle = useWorkerIdleDetection(status)
  const [retryLoading, setRetryLoading] = useState(false)
  const refreshedRef = useRef(false)
  const retainedFlagsRef = useRef<PartialFlag[]>([])

  useEffect(() => {
    if (isComplete && !refreshedRef.current) {
      refreshedRef.current = true
      const flags = Array.isArray(audit?.flags) ? (audit.flags as { severity?: string }[]) : []
      const durationMs =
        typeof audit?.durationMs === 'number' ? audit.durationMs : undefined
      const highestSeverity = flags.reduce<string | undefined>((best, f) => {
        const order = { CRITICAL: 0, IMPORTANT: 1, POLISH: 2 }
        const s = f.severity
        if (!s || !(s in order)) return best
        if (!best) return s
        return order[s as keyof typeof order] < order[best as keyof typeof order] ? s : best
      }, undefined)
      const score =
        typeof statusPayload?.score === 'number'
          ? statusPayload.score
          : typeof audit?.score === 'number'
            ? audit.score
            : undefined
      trackEvent('audit_completed', {
        audit_id: id,
        score,
        duration_ms: durationMs,
        finding_count: flags.length || undefined,
        highest_severity: highestSeverity,
      })
      // Server-rendered AuditReport replaces the progressive shell. No client full-fetch.
      router.refresh()
    }
  }, [isComplete, router, id, statusPayload?.score, audit?.score, audit?.durationMs, audit?.flags])

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

    const incomingFlags = statusPayload?.partialFlags
    if (Array.isArray(incomingFlags) && incomingFlags.length > 0) {
      retainedFlagsRef.current = incomingFlags
    }
    const partialFlags =
      Array.isArray(incomingFlags) && incomingFlags.length > 0
        ? incomingFlags
        : retainedFlagsRef.current

    return {
      status,
      progress,
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
      rubrics,
      partialFlags,
      screenshots,
      screenshotCapture:
        statusPayload?.screenshotCapture ??
        (raw?.screenshotCapture as AuditStatusPayload['screenshotCapture']),
      workerIdle,
      actionTimeline: statusPayload?.actionTimeline ?? [],
      productContract: statusPayload?.productContract ?? null,
      technologyProfile: statusPayload?.technologyProfile,
    }
  }, [status, progress, statusPayload?.partialFlags,
      statusPayload?.screenshots, statusPayload?.rubrics, statusPayload?.actionTimeline,
      statusPayload?.productContract, statusPayload?.technologyProfile,
      statusPayload?.screenshotCapture, statusPayload?.url, statusPayload?.pageType,
      statusPayload?.verdict, statusPayload?.score,
      initialAudit, workerIdle])

  async function handleRetrySameAudit() {
    setRetryLoading(true)
    try {
      const res = await fetch(`/api/reports/${id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        toast.error(parsed.message)
        return
      }
      router.refresh()
    } catch {
      toast.error(SYSTEM_COPY.errors.genericRetry)
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

  // In-progress and COMPLETED hold share the progressive frame until SSR swap.
  return (
    <AuditShell session={session}>
      <div
        className={requireAuthGate ? 'pointer-events-none select-none blur-[3px]' : undefined}
        aria-hidden={requireAuthGate || undefined}
        inert={requireAuthGate ? true : undefined}
      >
        <ProgressiveErrorBoundary onRetry={() => router.refresh()}>
          <AuditReportProgressive {...progressiveProps} />
        </ProgressiveErrorBoundary>
      </div>
      <ReportAuthGate
        auditId={id}
        required={requireAuthGate}
        reportUrl={progressiveProps.url}
      />
    </AuditShell>
  )
}
