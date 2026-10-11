import { SiteSettingsSection } from './SiteSettingsSection'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
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
      title={S.title}
      description={S.description}
      presentation={view.presentation}
      watch={view.watch}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <SiteSettingsSection aria-labelledby="settings-outcomes-heading">
        <h2 id="settings-outcomes-heading" className="text-lg font-semibold">{S.outcomes}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {SITE_BOARD_COPY.settingsActionsBody}
        </p>
        <SiteOutcomeConfirmList siteId={siteId} outcomes={view.outcomes} fixtures={fixtures} />
        {view.site.projectId ? (
          <details id="signup-setup" className="mt-6 rounded-nested-md bg-muted/20 p-4">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">{S.signupSetup}</summary>
            <p className="mt-1 text-sm text-muted-foreground">{S.signupBody}</p>
            <SafeFormFixtures siteId={siteId} initial={fixtures} />
          </details>
        ) : null}
      </SiteSettingsSection>

      <SiteSettingsControls siteId={siteId} watch={view.watch} initial={settings} />
      </div>
    </SiteShell>
  )
}
