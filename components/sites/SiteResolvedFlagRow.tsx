import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { formatEvidenceTimestamp } from '@/lib/time/format'

export function SiteResolvedFlagRow({ siteId, flag }: { siteId: string; flag: SiteFlagSeed }) {
  const scope = flag.affectedPageCount === 1 ? '1 affected page' : `${flag.affectedPageCount} affected pages`
  return <article className="flex min-h-20 flex-col gap-3 border-b border-border/60 bg-background px-4 py-4 last:border-b-0 sm:flex-row sm:items-center">
    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{CARD_CATALOG[flag.area].name}</span>
        <span>{scope}</span>
        {flag.latestOccurrenceAt ? <span>Verified {formatEvidenceTimestamp(flag.latestOccurrenceAt)}</span> : null}
      </p>
      <h3 className="mt-1 text-sm font-medium sm:text-base">{flag.problem}</h3>
    </div>
    <Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${flag.id}`}>View proof</Link></Button>
  </article>
}
