'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuditPolling } from '@/hooks/useAuditPolling'
import { AuditProgress } from '@/components/audit/AuditProgress'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Container } from '@/components/ui/container'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { parseApiErrorResponse } from '@/lib/api/errors'

function formatAuditErrorMessage(errorMsg?: string | null): string {
  if (!errorMsg) {
    return "We couldn't complete this audit. The site may be unreachable or blocking bots."
  }
  if (errorMsg.includes('Invalid judge output')) {
    return "We couldn't finish the AI review. Please try again in a moment."
  }
  if (errorMsg.startsWith('AI analysis unavailable:')) {
    return errorMsg.replace('AI analysis unavailable:', 'We could not finish the AI review:').trim()
  }
  return errorMsg
}

interface Props {
  id: string
  initialAudit?: Record<string, unknown> | null
  pollStatus?: boolean
  session?: { user: { id: string } } | null
}

export function AuditPageClient({ id, initialAudit, pollStatus = true, session }: Props) {
  const router = useRouter()
  const { audit, isLoading, isComplete, isFailed, isNotFound, isForbidden, fetchError, status, progress, url, startedAt, statusPayload } =
    useAuditPolling(id, { initialAudit, pollStatus })
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

  const desktopScreenshot = statusPayload?.screenshots?.find(
    (s) => s.device === 'DESKTOP'
  )
  const mobileScreenshot = statusPayload?.screenshots?.find(
    (s) => s.device === 'MOBILE'
  )

  async function handleRetry() {
    const retryUrl = url ?? (initialAudit?.url as string | undefined)
    if (!retryUrl) return
    setRetryLoading(true)
    setLimitGate(null)
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: retryUrl }),
      })
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (res.status === 402) {
          setLimitGate(parsed)
        } else {
          toast.error(parsed.message)
        }
        return
      }
      const data = await res.json()
      router.push(`/audit/${data.auditId}`)
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
      (statusPayload?.errorMsg as string | undefined)

    return (
      <AuditShell session={session}>
        <Container className="py-24 text-center space-y-4 max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Audit failed</h2>
          <p className="text-muted-foreground text-sm">
            {formatAuditErrorMessage(errorMsg)}
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleRetry} disabled={retryLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button asChild>
                <Link href="/">New audit</Link>
              </Button>
            </div>
            {limitGate && (
              <div className="w-full max-w-md">
                <AuditLimitGate
                  message={limitGate.message}
                  code={limitGate.code}
                  action={limitGate.action}
                  onDismiss={() => setLimitGate(null)}
                />
              </div>
            )}
          </div>
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
