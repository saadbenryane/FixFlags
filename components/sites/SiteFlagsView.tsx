import Link from 'next/link'
import { Check } from 'lucide-react'
import { SiteFlagRow } from '@/components/sites/SiteFlagRow'
import { SiteShell } from '@/components/sites/SiteShell'
import { Button } from '@/components/ui/button'
import type { SiteHomeView } from '@/lib/sites/application/queries'

export function SiteFlagsView({ siteId, view }: { siteId: string; view: SiteHomeView }) {
  return (
    <SiteShell
      siteId={siteId}
      activeRoute="flags"
      title="Flags"
      description="Open attention first, followed by recovered and recurring history."
      flagCount={view.flags.length}
      watch={view.watch}
    >
      <section aria-labelledby="open-flags-heading">
        <h2 id="open-flags-heading" className="text-lg font-semibold">Open attention</h2>
        <p className="mt-1 text-sm text-muted-foreground">Evidence-backed problems that still need a fix.</p>
        <div className="mt-4 space-y-3">
          {view.flags.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-background p-8 text-center">
              {view.statusState === 'healthy' ? <Check className="mx-auto h-8 w-8 text-success" aria-hidden /> : null}
              <h3 className="mt-3 text-xl font-semibold">
                {view.statusState === 'healthy' ? 'Nothing needs you right now.' : 'No Flags yet. Coverage is still incomplete.'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{view.coverageSummary}</p>
              <Button className="mt-4" variant="outline" asChild>
                <Link href={`/sites/${siteId}`}>Back to Site home</Link>
              </Button>
            </div>
          ) : view.flags.map((flag) => <SiteFlagRow key={flag.id} siteId={siteId} flag={flag} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="flag-history-heading">
        <h2 id="flag-history-heading" className="text-lg font-semibold">Recovery and recurrence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified recoveries and recurring Flags appear here when history is available. Open Flags never disappear merely because a fix was recorded.
        </p>
      </section>
    </SiteShell>
  )
}
