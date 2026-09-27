import Link from 'next/link'
import { ChevronRight, CircleAlert } from 'lucide-react'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { customerFlagContext } from '@/lib/sites/flag-label'
import { cn } from '@/lib/utils'

export function SiteFlagRow({ siteId, flag }: { siteId: string; flag: SiteFlagSeed }) {
  return (
    <Link
      href={`/sites/${siteId}/flags/${flag.id}`}
      className="flex min-h-11 items-start gap-3 rounded-2xl border border-border/80 bg-background p-5 transition hover:border-foreground/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <CircleAlert className={cn('mt-0.5 h-5 w-5', flag.severity === 'CRITICAL' ? 'text-destructive' : 'text-brand')} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{customerFlagContext(flag.area, flag.severity)}</p>
        <h3 className="mt-1 font-medium">{flag.problem}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{flag.whyItMatters}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
    </Link>
  )
}
