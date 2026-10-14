'use client'

import { useState } from 'react'
import { SiteIntegrationsPanel, type GoogleProvider } from './SiteIntegrationsPanel'
import { useRouter } from 'next/navigation'
import type { PublicConnection } from '@/lib/sites/connections/match'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
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
  async function disconnectShopify() {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/shopify`, { method: 'DELETE' }, 'acknowledgement'),
      () => { setShop(''); return C.settings.shopifyDisconnected }, () => router.refresh())
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

  return <SiteIntegrationsPanel siteId={siteId} shopify={{ ...initial.shopify, domain: shop || null }} searchConsole={searchConsole} analytics={analytics} busy={busy}
    onDisconnectShopify={() => void disconnectShopify()} onDisconnectGoogle={provider => void disconnectGoogle(provider)}
    feedback={<SiteActionFeedback message={message} error={error} siteId={siteId} />} />
}
