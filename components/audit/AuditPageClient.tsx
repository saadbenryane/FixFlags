'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuditPolling } from '@/hooks/useAuditPolling'
import { useWorkerIdleDetection } from '@/hooks/useWorkerIdleDetection'
import { AuditReportLoading } from '@/components/audit/AuditReportLoading'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { toast } from 'sonner'
import { BRAND } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import {
  setActiveAudit,
  clearActiveAudit,
  auditHostname,
} from '@/lib/audit/active-audit'

interface Props {
  id: string
  initialAudit?: Record<string, unknown> | null
  pollStatus?: boolean
  session?: { user: { id: string } } | null
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
    if (inProgress && url) {
      setActiveAudit({ auditId: id, url })
    }
  }, [id, inProgress, isComplete, isFailed, url])

  useEffect(() => {
    if (isComplete || isFailed) {
      document.title = BRAND.name
      return
    }
    if (inProgress && url) {
      document.title = `Checking ${auditHostname(url)} · ${BRAND.name}`
    }
    return () => {
      document.title = BRAND.name
    }
  }, [status, url, inProgress, isComplete, isFailed])

  const desktopScreenshot = statusPayload?.screenshots?.find((s) => s.device === 'DESKTOP')
  const mobileScreenshot = statusPayload?.screenshots?.find((s) => s.device === 'MOBILE')

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
            auditId={id}
            errorMsg={errorMsg}
            failureCode={statusPayload?.failureCode}
            failureStage={statusPayload?.failureStage}
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

  const finishing = isComplete && !isFailed

  return (
    <AuditShell session={session}>
      {(inProgress || finishing) && (
        <AuditReportLoading
          status={status}
          url={url}
          score={statusPayload?.score}
          flagCount={statusPayload?.flagCount ?? statusPayload?.partialFlags?.length ?? 0}
          rubrics={statusPayload?.rubrics}
          desktopScreenshotUrl={desktopScreenshot?.url}
          mobileScreenshotUrl={mobileScreenshot?.url}
          screenshotCapture={statusPayload?.screenshotCapture}
          workerIdle={workerIdle}
          finishing={finishing}
        />
      )}
    </AuditShell>
  )
}
