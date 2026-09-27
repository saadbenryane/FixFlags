import { Check } from 'lucide-react'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteShell } from '@/components/sites/SiteShell'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { outcomeCoverageLabel, outcomeStatusLabel } from '@/lib/sites/outcome-state'

export function SiteSettingsView({ siteId, view }: { siteId: string; view: SiteHomeView }) {
  const settings = view.settings ?? {
    notificationLevel: 'FLAGS' as const,
    notifyOnRecovery: true,
    shopify: { state: 'not_connected' as const, domain: null },
    searchConsole: { provider: 'SEARCH_CONSOLE' as const, configured: false, status: 'not_connected' as const, propertyLabel: null, detail: null, lastSyncedAt: null },
    analytics: { provider: 'ANALYTICS' as const, configured: false, status: 'not_connected' as const, propertyLabel: null, detail: null, lastSyncedAt: null },
  }

  return (
    <SiteShell
      siteId={siteId}
      activeRoute="settings"
      title="Site settings"
      description="Watch and notifications, Outcomes and safe fixtures, connections, developer access, then removal."
      flagCount={view.flags.length}
      watch={view.watch}
    >
      <SiteSettingsControls siteId={siteId} watch={view.watch} initial={settings} />

      <section className="rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="settings-outcomes-heading">
        <h2 id="settings-outcomes-heading" className="text-lg font-semibold">Outcomes and fixtures</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm what this Site must keep doing. Safe Form verification stays unavailable until its owned fixture, reset, and cleanup are all configured.
        </p>
        <ul className="mt-4 space-y-3">
          {view.outcomes.map((outcome) => (
            <li key={outcome.id} className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-border/60 px-4 py-3">
              <div>
                <p className="font-medium">{outcome.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{outcomeCoverageLabel(outcome.environment, outcome.bindings)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{outcomeStatusLabel(outcome.state, outcome.running)}</p>
              </div>
              {outcome.confirmedAt ? (
                <span className="inline-flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" aria-hidden />Confirmed</span>
              ) : (
                <span className="text-sm text-muted-foreground">Inferred, confirmation required</span>
              )}
            </li>
          ))}
          {view.outcomes.length === 0 ? <li className="text-sm text-muted-foreground">No Outcome has been confirmed for this Site yet.</li> : null}
        </ul>
      </section>
    </SiteShell>
  )
}
