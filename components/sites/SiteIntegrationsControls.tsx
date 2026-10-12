'use client'

import { useState } from 'react'
import { SiteIntegrationsPanel, type GoogleProvider } from './SiteIntegrationsPanel'
import { useRouter } from 'next/navigation'
import type { PublicConnection } from '@/lib/sites/connections/match'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SITE_CONNECTION_COPY as G } from '@/lib/marketing/copy/site-connections'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SiteActionFeedback } from './SiteActionFeedback'


export function SiteIntegrationsControls({ siteId, initial }: {
  siteId: string; initial: SiteHomeView['settings']
}) {
  const router = useRouter()
  const [shop, setShop] = useState(initial.shopify.domain ?? '')
  const [searchConsole, setSearchConsole] = useState(initial.searchConsole)
  const [analytics, setAnalytics] = useState(initial.analytics)
  const { busy, message, error, submit } = useSiteAction()
  async function connectShopify() {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/shopify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop }),
    }, 'authorize'), body => { window.location.assign(body.authorizeUrl); return null })
  }

  async function disconnectShopify() {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/shopify`, { method: 'DELETE' }, 'acknowledgement'),
      () => { setShop(''); return C.settings.shopifyDisconnected }, () => router.refresh())
  }

  async function connectGoogle(provider: GoogleProvider) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, action: 'connect' }),
    }, 'authorize'), body => { window.location.assign(body.authorizeUrl); return null })
  }

  async function refreshGoogle(provider: GoogleProvider) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, action: 'sync' }),
    }, 'connectionSync'), body => {
      const update = (connection: PublicConnection) => ({ ...connection, status: body.status, detail: body.detail })
      if (provider === 'SEARCH_CONSOLE') setSearchConsole(update)
      else setAnalytics(update)
      return body.status === 'connected' ? G.refreshed : body.detail
    }, () => router.refresh())
  }

  async function disconnectGoogle(provider: GoogleProvider) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }),
    }, 'acknowledgement'), () => {
      const update = (connection: PublicConnection): PublicConnection => ({ ...connection, status: 'revoked', detail: C.settings.disconnectedDetail })
      if (provider === 'SEARCH_CONSOLE') setSearchConsole(update)
      else setAnalytics(update)
      return C.settings.googleDisconnected(provider)
    }, () => router.refresh())
  }

  return <SiteIntegrationsPanel shopify={initial.shopify} shop={shop} searchConsole={searchConsole} analytics={analytics} busy={busy}
    onShopChange={setShop} onConnectShopify={() => void connectShopify()} onDisconnectShopify={() => void disconnectShopify()}
    onConnectGoogle={provider => void connectGoogle(provider)} onDisconnectGoogle={provider => void disconnectGoogle(provider)} onRefreshGoogle={provider => void refreshGoogle(provider)}
    feedback={<SiteActionFeedback message={message} error={error} siteId={siteId} />} />
}
