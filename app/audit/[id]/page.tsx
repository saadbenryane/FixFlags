'use client'
import { use } from 'react'
import Link from 'next/link'
import { useAuditPolling } from '@/hooks/useAuditPolling'
import { AuditProgress } from '@/components/audit/AuditProgress'
import { AuditVerdict } from '@/components/audit/AuditVerdict'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { AreaCard } from '@/components/audit/AreaCard'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Share2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  params: Promise<{ id: string }>
}

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

export default function AuditPage({ params }: Props) {
  const { id } = use(params)
  const { audit, isLoading, isComplete, isFailed, status } = useAuditPolling(id)

  const desktopScreenshot = audit?.screenshots?.find(
    (s: { device: string }) => s.device === 'DESKTOP'
  )

  async function handleShare() {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    toast.success('Report URL copied to clipboard')
  }

  async function handleRecheck() {
    const res = await fetch(`/api/audits/${id}/recheck`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      window.location.href = `/audit/${data.auditId}`
    } else {
      toast.error(data.error || 'Failed to start re-check')
    }
  }

  if (isFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Audit failed</h2>
          <p className="text-muted-foreground text-sm">
            {audit?.errorMsg || "We couldn't complete this audit. The site may be unreachable or blocking bots."}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={handleRecheck}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button asChild>
              <Link href="/">New audit</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const inProgress = !isComplete && !isFailed

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          QualityOS
        </Link>
        {isComplete && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button size="sm" onClick={handleRecheck}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-check
            </Button>
          </div>
        )}
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Progress */}
        {inProgress && (
          <div className="flex flex-col items-center py-12 space-y-6">
            <h2 className="text-xl font-semibold">Auditing your site...</h2>
            <AuditProgress
              status={status}
              desktopScreenshotUrl={desktopScreenshot?.url}
            />
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !audit && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Results */}
        {isComplete && audit && (
          <>
            {/* Verdict */}
            <AuditVerdict
              pageJob={audit.pageJob}
              pageType={audit.pageType}
              verdict={audit.verdict}
              score={audit.score}
              url={audit.url}
            />

            {/* Screenshots */}
            {audit.screenshots?.length > 0 && (
              <ScreenshotViewer screenshots={audit.screenshots} />
            )}

            {/* Area grid */}
            <AreaGrid areas={audit.areas} />

            {/* Area cards */}
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
                    isPaid={false}
                    defaultOpen={area.grade !== 'A'}
                  />
                )
              })}
            </div>

            {/* CTA for anon users */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
              <h3 className="font-semibold">Save this report + get more free audits</h3>
              <p className="text-sm text-muted-foreground">
                Create a free account to save audit history and get 3 audits per month.
              </p>
              <div className="flex justify-center gap-3">
                <Button asChild>
                  <Link href="/sign-up">Create free account</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pricing">See paid plans</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
