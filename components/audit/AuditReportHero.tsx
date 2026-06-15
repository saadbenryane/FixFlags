import { Badge } from '@/components/ui/badge'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { ScoringLegend } from '@/components/audit/ScoringLegend'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import {
  launchReadinessLabel,
  launchReadinessTone,
} from '@/lib/audit/launch-readiness'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle } from 'lucide-react'
import { gradeFromScore } from '@/lib/audit/scoring'

type Props = {
  pageJob: string | null
  pageType: string | null
  verdict: string | null
  score: number | null
  url: string
  screenshots?: AuditScreenshot[] | null
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  launchReadiness?: LaunchReadinessData | null
  pageSpeedPartial?: boolean
  desktopPageSpeedError?: string | null
  mobilePageSpeedError?: string | null
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
  const scoreGrade = score === null ? null : gradeFromScore(score)

  return (
    <div className="space-y-6">
      {launchReadiness && (
        <div className="rounded-card border-0 bg-card p-4 space-y-3 shadow-card">
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
        <ScoreDisplay grade={scoreGrade} score={score} variant="hero" />
        <div className="flex-1 min-w-0 space-y-3">
          <ScoringLegend compact />
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
          Visual review limited, desktop screenshot could not be captured for this audit.
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
