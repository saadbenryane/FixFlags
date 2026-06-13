'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuditPolling } from '@/hooks/useAuditPolling'
import { AuditProgress } from '@/components/audit/AuditProgress'
import { AuditVerdict } from '@/components/audit/AuditVerdict'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { AreaCard } from '@/components/audit/AreaCard'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Container } from '@/components/ui/container'
import { RefreshCw, Share2, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { UPSELLS, AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { parseApiErrorResponse } from '@/lib/api/errors'

interface Props {
  id: string
  isPaid: boolean
  isLoggedIn: boolean
  session?: { user: { id: string } } | null
}

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

export function AuditPageClient({ id, isPaid, isLoggedIn, session }: Props) {
  const router = useRouter()
  const { audit, isLoading, isComplete, isFailed, isNotFound, isForbidden, fetchError, status } =
    useAuditPolling(id)
  const [isPublic, setIsPublic] = useState<boolean | null>(null)
  const [retryLoading, setRetryLoading] = useState(false)

  const desktopScreenshot = audit?.screenshots?.find(
    (s: { device: string }) => s.device === 'DESKTOP'
  )

  async function handleShare() {
    try {
      const res = await fetch(`/api/audits/${id}/toggle-public`, { method: 'PATCH' })
      const data = await res.json()
      if (res.ok) {
        setIsPublic(data.isPublic)
        if (data.isPublic) {
          await navigator.clipboard.writeText(window.location.href)
          toast.success('Report is now public. URL copied to clipboard.')
        } else {
          toast.success('Report is now private.')
        }
      } else {
        toast.error(data.error || 'Failed to update sharing')
      }
    } catch {
      toast.error('Failed to update sharing')
    }
  }

  async function handleRecheck() {
    const res = await fetch(`/api/audits/${id}/recheck`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      router.push(`/audit/${data.auditId}`)
    } else {
      toast.error(data.error || 'Failed to start re-check')
    }
  }

  async function handleRetry() {
    if (!audit?.url) return
    setRetryLoading(true)
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: audit.url }),
      })
      if (!res.ok) {
        toast.error(await parseApiErrorResponse(res))
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

  const actions =
    isComplete && audit ? (
      <>
        {audit?.parentId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/compare/${id}`}>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              View comparison
            </Link>
          </Button>
        )}
        {isLoggedIn && (
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            {(isPublic !== null ? isPublic : audit?.isPublic) ? 'Make private' : 'Share'}
          </Button>
        )}
        {isPaid && (
          <Button size="sm" onClick={handleRecheck}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-check
          </Button>
        )}
      </>
    ) : undefined

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
    return (
      <AuditShell session={session}>
        <Container className="py-24 text-center space-y-4 max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Audit failed</h2>
          <p className="text-muted-foreground text-sm">
            {audit?.errorMsg || "We couldn't complete this audit. The site may be unreachable or blocking bots."}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={handleRetry} disabled={retryLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button asChild>
              <Link href="/">New audit</Link>
            </Button>
          </div>
        </Container>
      </AuditShell>
    )
  }

  const inProgress = !isComplete && !isFailed

  return (
    <AuditShell session={session} actions={actions}>
      <Container className="max-w-3xl py-8 space-y-8">
        {inProgress && (
          <div className="flex flex-col items-center py-12 space-y-6">
            <h2 className="text-xl font-semibold">{AUDIT_PROGRESS.inProgress}</h2>
            <AuditProgress
              status={status}
              desktopScreenshotUrl={desktopScreenshot?.url}
            />
          </div>
        )}

        {isLoading && !audit && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {isComplete && audit && (
          <>
            <AuditVerdict
              pageJob={audit.pageJob}
              pageType={audit.pageType}
              verdict={audit.verdict}
              score={audit.score}
              url={audit.url}
            />

            {audit.screenshots?.length > 0 && (
              <ScreenshotViewer screenshots={audit.screenshots} />
            )}

            <AreaGrid areas={audit.areas} />

            <div className="space-y-3">
              {AREA_ORDER.map((areaName) => {
                const area = audit.areas?.find(
                  (a: { name: string }) => a.name === areaName
                )
                if (!area) return null
                return (
                  <AreaCard
                    key={area.id}
                    area={area}
                    isPaid={isPaid}
                    defaultOpen={area.grade !== 'A'}
                  />
                )
              })}
            </div>

            {!isLoggedIn && (
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
                <h3 className="font-semibold">{UPSELLS.anon.headline}</h3>
                <p className="text-sm text-muted-foreground">{UPSELLS.anon.body}</p>
                <div className="flex justify-center gap-3">
                  <Button asChild>
                    <Link href="/sign-up">{UPSELLS.anon.primaryCta}</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/pricing">{UPSELLS.anon.secondaryCta}</Link>
                  </Button>
                </div>
              </div>
            )}

            {isLoggedIn && !isPaid && (() => {
              const FREE_FINDING_LIMIT = 3
              const hiddenCount = audit.areas?.reduce((sum: number, area: { findings: unknown[] }) => {
                const hidden = Math.max(0, (area.findings?.length ?? 0) - FREE_FINDING_LIMIT)
                return sum + hidden
              }, 0) ?? 0

              return (
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
                  <h3 className="font-semibold">{UPSELLS.freeUser.headline(hiddenCount)}</h3>
                  <p className="text-sm text-muted-foreground">{UPSELLS.freeUser.body}</p>
                  <Button asChild>
                    <Link href="/pricing">{UPSELLS.freeUser.cta}</Link>
                  </Button>
                </div>
              )
            })()}
          </>
        )}
      </Container>
    </AuditShell>
  )
}
