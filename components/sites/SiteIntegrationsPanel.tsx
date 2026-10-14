'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { SITE_CONNECTION_COPY as C } from '@/lib/marketing/copy/site-connections'
import { INTEGRATIONS_PAGE } from '@/lib/marketing/copy/integrations'
import { ToolLogo } from './SiteTooling'
import { SiteSettingsSection } from './SiteSettingsSection'
import { Button } from '@/components/ui/button'
import type { PublicConnection } from '@/lib/sites/connections/match'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import styles from './SiteIntegrationsPanel.module.css'

export type GoogleProvider = 'SEARCH_CONSOLE' | 'ANALYTICS'

export function SiteIntegrationsPanel({ shopify, searchConsole, analytics, busy = false, onDisconnectShopify, onDisconnectGoogle, feedback, siteId }: {
  siteId?: string;
  shopify: SiteHomeView['settings']['shopify']; searchConsole: PublicConnection; analytics: PublicConnection; busy?: boolean;
  onDisconnectShopify: () => void; onDisconnectGoogle: (provider: GoogleProvider) => void;
  feedback?: ReactNode;
}) {
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <p className={styles.description}>{C.availabilityBody}</p>
    {INTEGRATIONS_PAGE.items.map(item => {
      const google = item.id === 'analytics' ? analytics : item.id === 'search-console' ? searchConsole : null
      const savedShop = item.id === 'shopify' && Boolean(shopify.domain)
      const savedGoogle = google && google.propertyLabel
      return <SiteSettingsSection key={item.id} id={`connection-${item.id}`}>
        <div className={styles.header}><ToolLogo name={item.title} /><div><h3>{item.title}</h3><span className={styles.status}>{item.status === 'available' ? C.available : C.comingSoon}</span></div></div>
        <p className={styles.description}>{item.summary}</p>
        {'href' in item && item.href.startsWith('/docs/') ? <Link className={styles.guide} href={item.href}>{C.guide(item.title)}</Link> : null}
        {item.id === 'github' ? <div className={styles.actions}><Button asChild variant="outline"><Link href={siteId ? `/settings/integrations?next=${encodeURIComponent(`/sites/${siteId}?view=integrations`)}` : '/settings/integrations'}>{C.manageGithub}</Link></Button></div> : null}
        {savedShop || savedGoogle ? <>
          <p className={styles.description}>{C.savedConnection}</p>
          <dl className={styles.property}><dt>{C.property}</dt><dd>{savedShop ? shopify.domain : google?.propertyLabel}</dd></dl>
          {google?.lastSyncedAt ? <p className={styles.timestamp}>{C.lastRead(formatEvidenceTimestamp(google.lastSyncedAt) ?? google.lastSyncedAt)}</p> : null}
          <div className={styles.actions}><Button variant="outline" disabled={busy} onClick={() => savedShop ? onDisconnectShopify() : google ? onDisconnectGoogle(google.provider) : undefined}>{C.disconnect} {item.title}</Button></div>
        </> : null}
      </SiteSettingsSection>
    })}
    {feedback}
  </div>
}
