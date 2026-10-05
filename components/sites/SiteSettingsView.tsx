import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteOutcomeConfirmList } from '@/components/sites/SiteOutcomeConfirm'
import { SafeFormFixtures } from '@/components/sites/SafeFormFixtures'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'

export function SiteSettingsView({ siteId, view, fixtures = [] }: { siteId: string; view: SiteHomeView; fixtures?: OutcomeFixtureView[] }) {
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
      description="Choose what this Site must keep doing, then decide how FixFlags should watch and notify you."
      flagCount={view.flags.length}
      watch={view.watch}
    >
      <section className="rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="settings-outcomes-heading">
        <h2 id="settings-outcomes-heading" className="text-lg font-semibold">Outcomes and fixtures</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm what this Site must keep doing. FixFlags only offers what it can actually verify, so an Outcome confirmed here is one it will check and report on. Safe Form verification stays unavailable until its owned fixture, reset, and cleanup are all configured.
        </p>
        <SiteOutcomeConfirmList siteId={siteId} outcomes={view.outcomes} fixtures={fixtures} />
        {view.site.projectId ? (
          <div className="mt-6 border-t border-border/60 pt-6">
            <h3 className="font-semibold">Safe Signup fixtures</h3>
            <p className="mt-1 text-sm text-muted-foreground">Use synthetic data and same-origin reset and cleanup hooks so FixFlags can submit a Signup form without leaving accounts behind.</p>
            <SafeFormFixtures siteId={siteId} initial={fixtures} />
          </div>
        ) : null}
      </section>

      <SiteSettingsControls siteId={siteId} watch={view.watch} initial={settings} />
    </SiteShell>
  )
}
