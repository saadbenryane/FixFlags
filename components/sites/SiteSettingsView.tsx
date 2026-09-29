import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteOutcomeConfirmList } from '@/components/sites/SiteOutcomeConfirm'
import type { SiteHomeView } from '@/lib/sites/application/queries'

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
          Confirm what this Site must keep doing. FixFlags only offers what it can actually verify, so an Outcome confirmed here is one it will check and report on. Safe Form verification stays unavailable until its owned fixture, reset, and cleanup are all configured.
        </p>
        <SiteOutcomeConfirmList siteId={siteId} outcomes={view.outcomes} />
      </section>
    </SiteShell>
  )
}
