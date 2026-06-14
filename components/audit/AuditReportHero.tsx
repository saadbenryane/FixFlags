import { Badge } from '@/components/ui/badge'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { cn } from '@/lib/utils'

interface Props {
  pageJob: string
  pageType: string
  verdict: string
  score: number
  url: string
  screenshots?: AuditScreenshot[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-grade-A bg-grade-A/10 border-grade-A/25'
  if (score >= 60) return 'text-grade-C bg-grade-C/10 border-grade-C/25'
  if (score >= 40) return 'text-grade-D bg-grade-D/10 border-grade-D/25'
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
}: Props) {
  const hasScreenshots = screenshots && screenshots.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            'rounded-xl border p-4 text-center min-w-[88px] shrink-0',
            scoreTone(score)
          )}
        >
          <div className="text-4xl font-bold tabular-nums">{score}</div>
          <div className="text-xs text-muted-foreground mt-1">/ 100</div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {pageType}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Page job: <span className="font-medium text-foreground">{pageJob}</span>
            </span>
          </div>
          <p className="font-display text-lg leading-snug text-foreground/90 italic text-pretty">
            &ldquo;{verdict}&rdquo;
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

      {hasScreenshots && <ScreenshotViewer screenshots={screenshots!} url={url} />}
    </div>
  )
}
