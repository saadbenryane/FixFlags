'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuditPolling } from '@/hooks/useAuditPolling'
import { AuditProgress } from '@/components/audit/AuditProgress'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Container } from '@/components/ui/container'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

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
    isLoading,
    isComplete,
    isFailed,
    isNotFound,
    isForbidden,
    fetchError,
    status,
    progress,
    url,
    startedAt,
    statusPayload,
  } = useAuditPolling(id, { initialAudit, pollStatus })
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
      router.refresh()
    }
  }, [isComplete, router])

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
        <Container className="py-24 text-center space-y-4">
          <h2 className="text-xl font-semibold">Audit not found</h2>
          <p className="text-muted-foreground text-sm">This audit does not exist or has been removed.</p>
          <Button asChild>
            <Link href="/">Start a new audit</Link>
          </Button>
        </Container>
      </AuditShell>
    )
  }

  if (isForbidden) {
    return (
      <AuditShell session={session}>
        <Container className="py-24 text-center space-y-4">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-muted-foreground text-sm">{fetchError || 'You do not have access to this audit.'}</p>
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
        <Container className="py-24 text-center space-y-4 max-w-lg mx-auto">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Audit failed</h2>
          <AuditFailurePanel
            auditId={id}
            errorMsg={errorMsg}
            failureCode={statusPayload?.failureCode}
            failureStage={statusPayload?.failureStage}
            onRetry={handleRetrySameAudit}
            retryLoading={retryLoading}
          />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Start a new audit</Link>
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

  const inProgress = !isComplete && !isFailed
  const finishing = isComplete && !isFailed

  return (
    <AuditShell session={session}>
      <Container className="max-w-4xl py-8 space-y-8">
        {inProgress && (
          <div className="space-y-6 py-6 md:py-10">
            <h2 className="text-xl font-semibold text-center md:text-left">
              {AUDIT_PROGRESS.inProgress}
            </h2>
            <AuditProgress
              status={status}
              progress={progress}
              url={url}
              startedAt={startedAt}
              desktopScreenshotUrl={desktopScreenshot?.url}
              mobileScreenshotUrl={mobileScreenshot?.url}
              screenshotCapture={statusPayload?.screenshotCapture}
            />
          </div>
        )}

        {finishing && (
          <div className="space-y-6 py-6 md:py-10">
            <h2 className="text-xl font-semibold text-center md:text-left">
              Preparing your report...
            </h2>
            <AuditProgress
              status="COMPLETED"
              progress={100}
              url={url}
              startedAt={startedAt}
              desktopScreenshotUrl={desktopScreenshot?.url}
              mobileScreenshotUrl={mobileScreenshot?.url}
            />
          </div>
        )}

        {isLoading && !audit && inProgress && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </Container>
    </AuditShell>
  )
}
