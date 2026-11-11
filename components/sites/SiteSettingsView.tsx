'use client'

import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteScanAccessSettings } from './SiteScanAccessSettings'
import { SiteResearchConsentSettings } from '@/components/sites/SiteResearchConsentSettings'
import { SiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { SiteResourceBoundary, useSharedSiteResource } from './SiteResourceBoundary'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteIntegrationsControls } from '@/components/sites/SiteIntegrationsControls'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'
import { SiteDeployChecksPanel, SiteSignupSetupPanel } from './SiteSettingsPanels'

export function SiteSettingsView(props: { siteId: string; view: SiteHomeView; fixtures?: OutcomeFixtureView[] }) {
  return <SiteResourceBoundary siteId={props.siteId} initial={props.view}><SiteSettingsContent siteId={props.siteId} fixtures={props.fixtures ?? []} /></SiteResourceBoundary>
}

function SiteSettingsContent({ siteId, fixtures }: { siteId: string; fixtures: OutcomeFixtureView[] }) {
  const { view, refresh, disconnected, readUnavailable } = useSharedSiteResource(siteId)
  return (
    <SiteShell
      actions={view.actions}
      siteId={siteId}
      activeRoute="settings"
      title={S.title}
      description={S.description}
      presentation={view.presentation}
      watch={view.watch}
      analysisStatus={<SiteAnalysisDetails view={view} disconnected={disconnected} readUnavailable={readUnavailable} onRetry={refresh} />}
    >
      <SiteSettingsControls key={`monitoring:${siteId}`} siteId={siteId} initial={view.settings} watch={view.watch} onRefresh={refresh}>
        {view.site.projectId ? <SiteScanAccessSettings key={`scan-access:${view.site.projectId}`} siteId={siteId} /> : null}
        {view.site.projectId ? <SiteDeployChecksPanel key={`deploy:${view.site.projectId}`} /> : null}
        {view.site.projectId ? <SiteSignupSetupPanel key={`signup-setup:${view.site.projectId}`} siteId={siteId} fixtures={fixtures} /> : null}
        <SiteResearchConsentSettings key={`research:${siteId}`} siteId={siteId} />
        <section id="integrations" aria-labelledby="settings-integrations-heading" className="space-y-3">
          <h2 id="settings-integrations-heading" className="text-lg font-semibold">{SITE_WORKSPACE_COPY.navigation.integrations}</h2>
          <SiteIntegrationsControls key={`integrations:${siteId}`} siteId={siteId} initial={view.settings} onRefresh={refresh} showUpcoming={false} />
        </section>
      </SiteSettingsControls>
    </SiteShell>
  )
}
