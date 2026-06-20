import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import { buildRubricScoreRows, reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import { ShareStatusBanner } from '@/components/audit/ShareStatusBanner'
import { displayVerdict } from '@/lib/audit/verdict'
import type { RubricComputed } from '@/lib/audit/rubric'

type RubricRow = {
  name: string
  score: number | null
  grade?: string | null
}

type Props = {
  pageType: string | null
  verdict: string | null
  score: number | null
  url: string
  screenshots?: AuditScreenshot[] | null
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  shareStatus: string
  rubrics: RubricComputed[]
  rubricRows: RubricRow[]
  flagCount: number
  hasFixPrompts: boolean
  pageSpeedPartial?: boolean
  desktopPageSpeedError?: string | null
  mobilePageSpeedError?: string | null
}

export function AuditReportHero({
  pageType,
  verdict,
  score,
  url,
  screenshots,
  screenshotLimited,
  screenshotPartial,
  shareStatus,
  rubrics,
  rubricRows,
  flagCount,
  hasFixPrompts,
  pageSpeedPartial,
  desktopPageSpeedError,
  mobilePageSpeedError,
}: Props) {
  const hasScreenshots = screenshots && screenshots.length > 0
  const userVerdict = displayVerdict(verdict)
  const rubricScores = buildRubricScoreRows(rubricRows)

  return (
    <div className="space-y-6">
      <ShareStatusBanner shareStatus={shareStatus} rubrics={rubrics} />

      <ReportScoreOverview
        score={score}
        rubricScores={rubricScores}
        fixLoop={{
          scanDetail: reportScanDetail(pageType),
          flags: [],
          flagCount,
          hasFixPrompts,
          defaultExpanded: false,
        }}
        scoreSize="md"
        compact={false}
        showProgress
        layout="split"
      />

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <Badge variant="secondary" className="text-xs capitalize">
            {pageType ?? 'Page type unavailable'}
          </Badge>
          <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
        </div>
        {userVerdict && (
          <blockquote className="border-l-2 border-brand pl-3 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:pl-4 sm:text-lg">
            {userVerdict}
          </blockquote>
        )}
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
