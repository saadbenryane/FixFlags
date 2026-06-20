'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ShareStatusBanner } from '@/components/audit/ShareStatusBanner'
import { displayVerdict } from '@/lib/audit/verdict'
import type { RubricComputed } from '@/lib/audit/rubric'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

type Props = {
  url?: string
  pageType?: string | null
  verdict?: string | null
  activityMessage?: string
  shareStatus?: string
  rubrics?: RubricComputed[]
}

export function ReportHeroHeader({
  url,
  pageType,
  verdict,
  activityMessage,
  shareStatus,
  rubrics = [],
}: Props) {
  const userVerdict = displayVerdict(verdict ?? null)
  const badgeLabel = pageType ?? 'Scanning'

  return (
    <div className="space-y-4">
      {shareStatus && rubrics.length > 0 && (
        <ShareStatusBanner shareStatus={shareStatus} rubrics={rubrics} />
      )}

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <Badge variant="secondary" className="text-xs capitalize">
            {badgeLabel}
          </Badge>
          {url ? (
            <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
          ) : (
            <Skeleton className="h-4 w-48" />
          )}
        </div>
        {userVerdict ? (
          <blockquote className="border-l-2 border-brand pl-3 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:pl-4 sm:text-lg">
            {userVerdict}
          </blockquote>
        ) : activityMessage ? (
          <p className="text-sm text-muted-foreground text-pretty" aria-live="polite">
            {activityMessage}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{AUDIT_PROGRESS.inProgress}</p>
        )}
      </div>
    </div>
  )
}
