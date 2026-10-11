import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { cn } from '@/lib/utils'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { Button } from '@/components/ui/button'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'

function pageLabel(url: string | null): string | null {
  if (!url) return null
  try {
    const page = new URL(url)
    return page.pathname === '/' ? page.host : page.pathname
  } catch {
    return null
  }
}

export function SiteFlagRow({ siteId, flag }: { siteId: string; flag: SiteFlagSeed }) {
  const scope = flag.affectedPageCount > 1
    ? `${flag.affectedPageCount} affected pages`
    : pageLabel(flag.affectedPaths[0] ?? flag.pageUrl)
  return (
    <article className="flex min-h-20 flex-col gap-3 rounded-card border border-brand/45 bg-background px-4 py-4 sm:flex-row sm:items-center">
      <CircleAlert className={cn('mt-0.5 h-5 w-5', flag.severity === 'CRITICAL' ? 'text-destructive' : 'text-brand')} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{CARD_CATALOG[flag.area].name}</span>{scope ? <span aria-hidden="true">·</span> : null}{scope ? <span className="min-w-0 break-words">{scope}</span> : null}</p>
        <h3 className="mt-1 text-sm font-medium sm:text-base">{flag.problem}</h3>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
        <SitePromptCopyButton compact siteId={siteId} flagId={flag.id} />
        <Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${flag.id}`}>View Flag</Link></Button>
      </div>
    </article>
  )
}
