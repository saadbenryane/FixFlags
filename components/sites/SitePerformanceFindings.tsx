import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { groupPerformanceFindings } from '@/lib/sites/performance-groups'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteFlagSelection } from './SiteFlagSelection'
import { SiteCardFindings } from './SiteCardFindings'

export function SitePerformanceFindings({ siteId, flags, availability, onOpenFlag }: { onOpenFlag?: (id: string, trigger?: HTMLElement) => void; siteId: string; flags: SiteFlagSeed[]; availability: SiteActionAvailability }) {
  if (!flags.length) return null
  return <SiteFlagSelection siteId={siteId} flags={flags} availability={availability}><section className="space-y-6">
    <p className="text-sm text-muted-foreground">{C.performanceGrouping}</p>
    {groupPerformanceFindings(flags).map((group, index) => <section key={index} className="space-y-3">
      <h3 className="text-sm font-medium">{group.device ? C.execution.devices[group.device] : C.performanceEvidence}</h3>
      {group.pageUrl ? <p className="break-all text-xs text-muted-foreground">{group.pageUrl}</p> : null}
      <SiteCardFindings siteId={siteId} flags={group.flags} recommendations={[]} copyAvailability={availability} showPage={false} onOpenFlag={onOpenFlag} />
    </section>)}
  </section></SiteFlagSelection>
}
