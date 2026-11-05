'use client'

import { SiteIntegrationsPanel, type GoogleProvider } from './SiteIntegrationsPanel'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SiteActionFeedback } from './SiteActionFeedback'


export function SiteIntegrationsControls({ siteId, initial, onRefresh }: {
  siteId: string; initial: SiteHomeView['settings']; onRefresh: () => Promise<unknown>
}) {
  const { busy, message, error, submit } = useSiteAction({ scope: siteId })
  async function disconnectShopify() {
    await submit(signal => executeSiteAction(`/api/sites/${siteId}/connections/shopify`, { method: 'DELETE', signal }, 'acknowledgement'),
      () => C.settings.shopifyDisconnected, onRefresh)
  }

  async function disconnectGoogle(provider: GoogleProvider) {
    await submit(signal => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      signal,
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }),
    }, 'acknowledgement'), () => C.settings.googleDisconnected(provider), onRefresh)
  }

  return <SiteIntegrationsPanel github={initial.github} siteId={siteId} shopify={initial.shopify} searchConsole={initial.searchConsole} analytics={initial.analytics} busy={busy}
    onDisconnectShopify={() => void disconnectShopify()} onDisconnectGoogle={provider => void disconnectGoogle(provider)}
    feedback={<SiteActionFeedback message={message} error={error} siteId={siteId} />} />
}
