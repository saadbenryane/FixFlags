'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { displayVerdict } from '@/lib/audit/verdict'
import { displayHostname } from '@/lib/utils/url-helpers'

type Props = {
  url?: string
  pageType?: string | null
  verdict?: string | null
}

export function ReportHeroHeader({
  url,
  pageType,
  verdict,
}: Props) {
  const userVerdict = displayVerdict(verdict ?? null)
  const badgeLabel = pageType ?? 'Scanning'
  const hostname = url ? displayHostname(url) : null

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {hostname ? (
          <h1 className="min-w-0 truncate text-xl font-semibold tracking-heading text-foreground sm:text-2xl">
            {hostname}
          </h1>
        ) : (
          <Skeleton className="h-7 w-44" />
        )}
        <Badge variant="secondary" className="text-xs capitalize text-foreground">
          {badgeLabel}
        </Badge>
      </div>
      {userVerdict ? (
        <blockquote className="border-l-2 border-brand pl-3 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:pl-4 sm:text-lg">
          {userVerdict}
        </blockquote>
      ) : null}
    </div>
  )
}
