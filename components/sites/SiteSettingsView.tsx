import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteOutcomeConfirmList } from '@/components/sites/SiteOutcomeConfirm'
import { SafeFormFixtures } from '@/components/sites/SafeFormFixtures'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

export function SiteSettingsView({ siteId, view, fixtures = [] }: { siteId: string; view: SiteHomeView; fixtures?: OutcomeFixtureView[] }) {
  const settings = view.settings

  return (
    <SiteShell
      siteId={siteId}
      ownerId={view.site.userId}
      activeRoute="settings"
      title="Site settings"
      description="Choose what this Site must keep doing, then decide how FixFlags should watch and notify you."
      presentation={view.presentation}
      watch={view.watch}
    >
      <section className="rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="settings-outcomes-heading">
        <h2 id="settings-outcomes-heading" className="text-lg font-semibold">Outcomes and coverage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {SITE_BOARD_COPY.settingsActionsBody}
        </p>
        <SiteOutcomeConfirmList siteId={siteId} outcomes={view.outcomes} fixtures={fixtures} />
        {view.site.projectId ? (
          <details id="signup-setup" className="mt-6 border-t border-border/60 pt-3">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">Signup test setup</summary>
            <p className="mt-1 text-sm text-muted-foreground">Use synthetic data and same-origin reset and cleanup hooks so FixFlags can submit a Signup form without leaving accounts behind.</p>
            <SafeFormFixtures siteId={siteId} initial={fixtures} />
          </details>
        ) : null}
      </section>

      <SiteSettingsControls siteId={siteId} watch={view.watch} initial={settings} />
    </SiteShell>
  )
}
