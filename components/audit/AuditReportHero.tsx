import { Badge } from '@/components/ui/badge'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import {
  launchReadinessLabel,
  launchReadinessTone,
} from '@/lib/audit/launch-readiness'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle } from 'lucide-react'
import { gradeFromScore } from '@/lib/audit/scoring'

interface Props {
  pageJob: string | null
  pageType: string | null
  verdict: string | null
  score: number | null
  url: string
  screenshots?: AuditScreenshot[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  launchReadiness?: LaunchReadinessData | null
  pageSpeedPartial?: boolean
  desktopPageSpeedError?: string
  mobilePageSpeedError?: string
}

function scoreTone(score: number | null): string {
  if (score === null) return 'text-muted-foreground bg-muted/50 border-border'
  const grade = gradeFromScore(score)
  if (grade === 'A') return 'text-grade-A bg-grade-A/10 border-grade-A/25'
  if (grade === 'B') return 'text-grade-B bg-grade-B/10 border-grade-B/25'
  if (grade === 'C') return 'text-grade-C bg-grade-C/10 border-grade-C/25'
  if (grade === 'D') return 'text-grade-D bg-grade-D/10 border-grade-D/25'
  return 'text-grade-F bg-grade-F/10 border-grade-F/25'
}

export function AuditReportHero({
  pageJob,
  pageType,
  verdict,
  score,
  url,
  screenshots,
  screenshotLimited,
  screenshotPartial,
  launchReadiness,
  pageSpeedPartial,
  desktopPageSpeedError,
  mobilePageSpeedError,
}: Props) {
  const hasScreenshots = screenshots && screenshots.length > 0

  return (
    <div className="space-y-6">
      {launchReadiness && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-semibold',
                launchReadinessTone(launchReadiness.readiness)
              )}
            >
              {launchReadinessLabel(launchReadiness.readiness)}
            </span>
            <span className="text-xs text-muted-foreground">Launch readiness</span>
          </div>
          {launchReadiness.checklist.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {launchReadiness.checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  {item.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-grade-A shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <span className={item.passed ? 'text-foreground/90' : 'text-foreground'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            'rounded-xl border p-4 text-center min-w-[88px] shrink-0',
            scoreTone(score)
          )}
        >
          <div className="text-4xl font-bold tabular-nums">{score ?? '—'}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {score === null ? 'Unavailable' : `/ 100 · Grade ${gradeFromScore(score)}`}
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {pageType ?? 'Page type unavailable'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Page job:{' '}
              <span className="font-medium text-foreground">
                {pageJob ?? 'Unavailable'}
              </span>
            </span>
          </div>
          <p className="font-display text-lg leading-snug text-foreground/90 italic text-pretty">
            &ldquo;{verdict ?? 'The available evidence was insufficient for a reliable verdict.'}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
      </div>

      {screenshotLimited && (
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Visual review limited — desktop screenshot could not be captured for this audit.
        </div>
      )}

      {screenshotPartial && !screenshotLimited && (
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Mobile screenshot could not be captured. Desktop viewport review is shown below.
        </div>
      )}

      {pageSpeedPartial && (
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground space-y-1">
          <p>PageSpeed data was partial for this audit.</p>
          {desktopPageSpeedError && (
            <p className="text-xs font-mono">Desktop: {desktopPageSpeedError}</p>
          )}
          {mobilePageSpeedError && (
            <p className="text-xs font-mono">Mobile: {mobilePageSpeedError}</p>
          )}
        </div>
      )}

      {hasScreenshots && <ScreenshotViewer screenshots={screenshots!} url={url} />}
    </div>
  )
}
