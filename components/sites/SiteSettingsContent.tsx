'use client'
import { useSiteResource } from '@/hooks/useSiteResource'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SiteSettingsControls } from './SiteSettingsControls'

export function SiteSettingsContent({ siteId, initial }: { siteId: string; initial: SiteHomeView }) {
  const { view, disconnected } = useSiteResource(siteId, initial)
  return <>
    {disconnected ? <p role="status" className="text-sm text-muted-foreground">{SITE_ACTION_COPY.updatesDisconnected}</p> : null}
    <SiteSettingsControls siteId={siteId} watch={view.watch} initial={view.settings} />
  </>
}
