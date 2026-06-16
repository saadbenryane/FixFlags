import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { ScoringLegend } from '@/components/audit/ScoringLegend'
import { gradeFromScore } from '@/lib/audit/scoring'
import { ShareStatusBanner } from '@/components/audit/ShareStatusBanner'
import type { RubricComputed } from '@/lib/audit/rubric'

type Props = {
  pageJob: string | null
  pageType: string | null
  verdict: string | null
  score: number | null
  url: string
  screenshots?: AuditScreenshot[] | null
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  shareStatus: string
  rubrics: RubricComputed[]
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
  shareStatus,
  rubrics,
  pageSpeedPartial,
  desktopPageSpeedError,
  mobilePageSpeedError,
}: Props) {
  const hasScreenshots = screenshots && screenshots.length > 0
  const scoreGrade = score === null ? null : gradeFromScore(score)

  return (
    <div className="space-y-6">
      <ShareStatusBanner shareStatus={shareStatus} rubrics={rubrics} />

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
              <span className="font-medium text-foreground">{pageJob ?? 'Unavailable'}</span>
            </span>
          </div>
          <blockquote className="border-l-2 border-brand pl-4 font-display text-lg font-medium leading-[1.45] text-foreground text-pretty">
            {verdict ?? 'The available evidence was insufficient for a reliable verdict.'}
          </blockquote>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
      </div>

      {screenshotLimited && (
        <Callout variant="neutral">
          Visual review limited - the desktop screenshot could not be captured for this report.
        </Callout>
      )}

      {screenshotPartial && !screenshotLimited && (
        <Callout variant="neutral">
          Mobile screenshot could not be captured. Desktop viewport review is shown below.
        </Callout>
      )}

      {pageSpeedPartial && (
        <Callout variant="neutral" title="PageSpeed data was partial for this report.">
          {(desktopPageSpeedError || mobilePageSpeedError) && (
            <div className="space-y-0.5 font-mono text-xs">
              {desktopPageSpeedError && <p>Desktop: {desktopPageSpeedError}</p>}
              {mobilePageSpeedError && <p>Mobile: {mobilePageSpeedError}</p>}
            </div>
          )}
        </Callout>
      )}

      {hasScreenshots && <ScreenshotViewer screenshots={screenshots!} url={url} />}
    </div>
  )
}
