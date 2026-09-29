import Link from 'next/link'
import { Check, History } from 'lucide-react'
import { SiteFlagRow } from '@/components/sites/SiteFlagRow'
import { SiteShell } from '@/components/sites/SiteShell'
import { Button } from '@/components/ui/button'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { useSearchParams } from 'next/navigation'

export function SiteFlagsView({ siteId, view }: { siteId: string; view: SiteHomeView }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'open'

  return (
    <SiteShell
      siteId={siteId}
      activeRoute="flags"
      title="Flags"
      description="Open attention first, followed by recovered and recurring history."
      flagCount={view.flags.length}
      watch={view.watch}
    >
      <div className="flex gap-2 border-b border-border/40 mb-6" role="tablist" aria-label="Flag lists">
        <Button
          role="tab"
          aria-selected={tab === 'open'}
          variant={tab === 'open' ? 'brand' : 'ghost'}
          size="sm"
          asChild
        >
          <Link href={`/sites/${siteId}/flags?tab=open`}>Open attention</Link>
        </Button>
        <Button
          role="tab"
          aria-selected={tab === 'resolved'}
          variant={tab === 'resolved' ? 'brand' : 'ghost'}
          size="sm"
          asChild
        >
          <Link href={`/sites/${siteId}/flags?tab=resolved`}>
            <History className="mr-1.5 h-4 w-4" aria-hidden />
            Resolved
          </Link>
        </Button>
      </div>

      {tab === 'open' ? (
        <section aria-labelledby="open-flags-heading">
          <h2 id="open-flags-heading" className="sr-only">Open attention</h2>
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
      ) : null}

      {tab === 'resolved' ? (
        <section aria-labelledby="resolved-flags-heading">
          <h2 id="resolved-flags-heading" className="sr-only">Resolved</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flags verified as fixed by an independent re-check. Each shows the proof audit and time.
          </p>
          <div className="mt-4 space-y-3">
            {view.resolvedFlags.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-background p-8 text-center">
                <History className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                <h3 className="mt-3 text-xl font-semibold">No verified recoveries yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  When Watch verifies a recovery, it will appear here with the proof audit and time.
                </p>
              </div>
            ) : view.resolvedFlags.map((flag) => <SiteFlagRow key={flag.id} siteId={siteId} flag={flag} />)}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="flag-history-heading">
        <h2 id="flag-history-heading" className="text-lg font-semibold">Recovery and recurrence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified recoveries and recurring Flags appear here when history is available. Open Flags never disappear merely because a fix was recorded.
        </p>
      </section>
    </SiteShell>
  )
}
