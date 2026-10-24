'use client'

import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteScanAccessSettings } from './SiteScanAccessSettings'
import { SiteResearchConsentSettings } from '@/components/sites/SiteResearchConsentSettings'
import { SiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { SiteResourceBoundary, useSharedSiteResource } from './SiteResourceBoundary'
import { SiteShell } from '@/components/sites/SiteShell'
import type { SiteHomeView } from '@/lib/sites/application/queries'

export function SiteSettingsView(props: { siteId: string; view: SiteHomeView }) {
  return <SiteResourceBoundary siteId={props.siteId} initial={props.view}><SiteSettingsContent siteId={props.siteId} /></SiteResourceBoundary>
}

function SiteSettingsContent({ siteId }: { siteId: string }) {
  const { view, refresh, disconnected } = useSharedSiteResource(siteId)
  return (
    <SiteShell
      actions={view.actions}
      siteId={siteId}
      ownerId={view.site.userId}
      activeRoute="settings"
      title={S.title}
      description={S.description}
      presentation={view.presentation}
      watch={view.watch}
      analysisStatus={<SiteAnalysisDetails view={view} disconnected={disconnected} />}
    >
      <SiteSettingsControls key={`monitoring:${siteId}`} target={view.site.url} siteId={siteId} initial={view.settings} watch={view.watch} onRefresh={refresh}>
        {view.site.projectId ? <SiteScanAccessSettings key={`scan-access:${view.site.projectId}`} siteId={siteId} /> : null}
        <SiteResearchConsentSettings key={`research:${siteId}`} siteId={siteId} />
      </SiteSettingsControls>
    </SiteShell>
  )
}
