import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { ShareStatusBanner } from '@/components/audit/ShareStatusBanner'
import { displayVerdict } from '@/lib/audit/verdict'
import type { RubricComputed } from '@/lib/audit/rubric'

type Props = {
  pageType: string | null
  verdict: string | null
  url: string
  shareStatus: string
  rubrics: RubricComputed[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  pageSpeedPartial?: boolean
  desktopPageSpeedError?: string | null
  mobilePageSpeedError?: string | null
}

export function AuditReportHero({
  pageType,
  verdict,
  url,
  shareStatus,
  rubrics,
  screenshotLimited,
  screenshotPartial,
  pageSpeedPartial,
  desktopPageSpeedError,
  mobilePageSpeedError,
}: Props) {
  const userVerdict = displayVerdict(verdict)

  return (
    <div className="space-y-4">
      <ShareStatusBanner shareStatus={shareStatus} rubrics={rubrics} />

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
    </div>
  )
}
