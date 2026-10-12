'use client'

import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { useSiteResource } from '@/hooks/useSiteResource'
import { SiteShell } from '@/components/sites/SiteShell'
import type { SiteHomeView } from '@/lib/sites/application/queries'

export function SiteSettingsView({ siteId, view: initial }: { siteId: string; view: SiteHomeView }) {
  const { view, disconnected } = useSiteResource(siteId, initial)
  return (
    <SiteShell
      siteId={siteId}
      ownerId={view.site.userId}
      activeRoute="settings"
      title={S.title}
      description={S.description}
      presentation={view.presentation}
      watch={view.watch}
      analysisStatus={<SiteAnalysisDetails view={view} disconnected={disconnected} />}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <SiteSettingsControls siteId={siteId} initial={view.settings} watch={view.watch} />
      </div>
    </SiteShell>
  )
}
