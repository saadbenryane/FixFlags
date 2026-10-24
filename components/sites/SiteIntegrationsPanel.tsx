'use client'

import Link from 'next/link'
import type { Route } from 'next'
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

export function SiteIntegrationsPanel({ github, shopify, searchConsole, analytics, busy = false, onDisconnectShopify, onDisconnectGoogle, feedback, siteId }: {
  siteId?: string; github?: SiteHomeView['settings']['github'];
  shopify: SiteHomeView['settings']['shopify']; searchConsole: PublicConnection; analytics: PublicConnection; busy?: boolean;
  onDisconnectShopify: () => void; onDisconnectGoogle: (provider: GoogleProvider) => void;
  feedback?: ReactNode;
}) {
  const saved = (id: string) => id === 'shopify' ? Boolean(shopify.domain) : id === 'analytics' ? Boolean(analytics.propertyLabel) : id === 'search-console' ? Boolean(searchConsole.propertyLabel) : false
  const primary = INTEGRATIONS_PAGE.items.filter(item => item.status === 'available' || saved(item.id))
  const upcoming = INTEGRATIONS_PAGE.items.filter(item => !primary.includes(item))
  const renderIntegration = (item: typeof INTEGRATIONS_PAGE.items[number]) => {
    const google = item.id === 'analytics' ? analytics : item.id === 'search-console' ? searchConsole : null
    const savedShop = item.id === 'shopify' && Boolean(shopify.domain)
    const savedGoogle = google && google.propertyLabel
    const disconnectable = savedShop || Boolean(google && google.propertyLabel && google.status !== 'revoked' && google.status !== 'not_connected')
    return <SiteSettingsSection key={item.id} id={`connection-${item.id}`}>
      <div className={styles.row}>
        <div className={styles.header}><ToolLogo name={item.title} /><div><h3>{item.title}</h3><p className={styles.purpose}>{item.purpose}</p></div></div>
        <div className={styles.rowAction}>
          {item.id === 'github' ? <GithubAction connection={github} siteId={siteId} /> : <span className={styles.status}>{C.comingSoon}</span>}
          {disconnectable ? <Button variant="ghost" size="sm" disabled={busy} aria-label={`${C.disconnect} ${item.title}`} onClick={() => savedShop ? onDisconnectShopify() : google ? onDisconnectGoogle(google.provider) : undefined}>{C.disconnect}</Button> : null}
        </div>
      </div>
      {savedShop || savedGoogle ? <details className={styles.savedDetails}><summary>{C.review}</summary>
        <p className={styles.description}>{google?.status === 'revoked' ? google.detail ?? C.states.revoked : C.savedConnection}</p>
        <dl className={styles.property}><dt>{C.property}</dt><dd>{savedShop ? shopify.domain : google?.propertyLabel}</dd></dl>
        {google?.lastSyncedAt ? <p className={styles.timestamp}>{C.lastRead(formatEvidenceTimestamp(google.lastSyncedAt) ?? google.lastSyncedAt)}</p> : null}
      </details> : null}
    </SiteSettingsSection>
  }
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    {primary.map(renderIntegration)}
    {upcoming.length ? <details className={styles.more}><summary>{C.moreIntegrations}<span>{upcoming.length}</span></summary><div>{upcoming.map(renderIntegration)}</div></details> : null}
    {feedback}
  </div>
}

function GithubAction({ connection, siteId }: { connection?: SiteHomeView['settings']['github']; siteId?: string }) {
  const saved = connection && connection.status !== 'not_connected'
  if (!connection?.configured && !saved) return <span className={styles.status}>{C.states.unavailable}</span>
  const label = !connection?.configured || connection.status === 'connected' ? C.manage : connection.status === 'revoked' ? C.reconnect : C.connect
  const href = siteId ? `/settings/integrations?next=${encodeURIComponent(`/sites/${siteId}?view=integrations`)}` : '/settings/integrations'
  return <><Button asChild variant="outline" size="sm"><Link aria-label={C.manageGithub} href={href as Route}>{label}</Link></Button>
    {connection?.status === 'connected' ? <span className={styles.status}><i data-connected="true" />{connection.login}</span> : null}</>
}
