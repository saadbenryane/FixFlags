'use client'

import type { ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SITE_CONNECTION_COPY as G } from '@/lib/marketing/copy/site-connections'
import { ToolLogo } from './SiteTooling'
import { SiteSettingsSection } from './SiteSettingsSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PublicConnection } from '@/lib/sites/connections/match'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { connectionPresentation } from '@/lib/sites/connection-presentation'
import styles from './SiteIntegrationsPanel.module.css'

export type GoogleProvider = 'SEARCH_CONSOLE' | 'ANALYTICS'

function ConnectionHeading({ name, title, status, connected, guide }: {
  name: string; title: string; status: string; connected: boolean; guide: string;
}) {
  return <div className={styles.header}><ToolLogo name={name} /><div><h3>{title}</h3><span className={styles.status}><i data-connected={connected} aria-hidden />{status}</span></div>
    <Link href={guide as Route} aria-label={G.guide(title)} className={styles.guide}>{G.guideLabel}<ArrowUpRight size={14} aria-hidden /></Link>
  </div>
}

export function SiteIntegrationsPanel({ shopify, shop, searchConsole, analytics, busy = false, onShopChange, onConnectShopify, onDisconnectShopify, onConnectGoogle, onDisconnectGoogle, onRefreshGoogle, feedback }: {
  shopify: SiteHomeView['settings']['shopify']; shop: string; searchConsole: PublicConnection; analytics: PublicConnection; busy?: boolean;
  onShopChange: (value: string) => void; onConnectShopify: () => void; onDisconnectShopify: () => void;
  onConnectGoogle: (provider: GoogleProvider) => void; onDisconnectGoogle: (provider: GoogleProvider) => void; onRefreshGoogle: (provider: GoogleProvider) => void;
  feedback?: ReactNode;
}) {
  const shopConnected = shopify.state === 'connected' && Boolean(shopify.domain)
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    {shopify.configured === false && !searchConsole.configured && !analytics.configured ? <p role="status" className={styles.description}>{G.unavailable}</p> : null}
    {shopify.configured === false ? null : <SiteSettingsSection id="connection-shopify">
      <ConnectionHeading name="Shopify" title={S.shopify} status={shopConnected ? G.states.connected : shopify.state === 'unavailable' ? G.states.unavailable : G.states.not_connected} connected={shopConnected} guide="/docs/integrations/shopify" />
      <p className={styles.description}>{S.shopifyBody}</p>
      {shopConnected ? <><dl className={styles.property}><dt>{S.connectedTo}</dt><dd>{shopify.domain}</dd></dl><div className={styles.actions}><Button variant="outline" disabled={busy} onClick={onDisconnectShopify}>{G.disconnect}</Button></div></> : <>
        {shopify.state === 'unavailable' ? <p className={styles.description}>{S.shopifyUnavailable}</p> : null}
        <div className={styles.shop}><Input value={shop} onChange={event => onShopChange(event.target.value)} placeholder={S.shopPlaceholder} aria-label={S.shopDomain} />
          <Button variant="brand" disabled={busy || !shop.trim()} onClick={onConnectShopify}>{shopify.state === 'unavailable' ? `${G.reconnect} ${S.shopify}` : S.connectShopify}</Button></div>
      </>}
    </SiteSettingsSection>}
    {searchConsole.configured ? <GoogleConnectionCard title={S.search} description={S.searchBody} connection={searchConsole} busy={busy}
      onConnect={() => onConnectGoogle('SEARCH_CONSOLE')} onDisconnect={() => onDisconnectGoogle('SEARCH_CONSOLE')} onRefresh={() => onRefreshGoogle('SEARCH_CONSOLE')} /> : null}
    {analytics.configured ? <GoogleConnectionCard title={S.analytics} description={S.analyticsBody} connection={analytics} busy={busy}
      onConnect={() => onConnectGoogle('ANALYTICS')} onDisconnect={() => onDisconnectGoogle('ANALYTICS')} onRefresh={() => onRefreshGoogle('ANALYTICS')} /> : null}
    {feedback}
  </div>
}

function GoogleConnectionCard({ title, description, connection, busy, onConnect, onDisconnect, onRefresh }: {
  title: string; description: string; connection: PublicConnection; busy: boolean; onConnect: () => void; onDisconnect: () => void; onRefresh: () => void;
}) {
  const presentation = connectionPresentation(connection.status, connection.configured)
  const linked = connection.status === 'connected' || connection.status === 'unavailable'
  const reconnect = ['mismatch', 'needs_reauth', 'revoked'].includes(connection.status)
  const search = connection.provider === 'SEARCH_CONSOLE'
  const name = search ? 'Google Search Console' : 'Google Analytics'
  return <SiteSettingsSection id={search ? 'connection-search-console' : 'connection-analytics'}>
    <ConnectionHeading name={name} title={title} status={presentation.label} connected={presentation.healthy} guide={search ? '/docs/integrations/google-search-console' : '/docs/integrations/google-analytics'} />
    <p className={styles.description}>{description}</p>
    {connection.propertyLabel ? <dl className={styles.property}><dt>{G.property}</dt><dd>{connection.propertyLabel}</dd></dl> : null}
    {connection.detail ? <p className={styles.description}>{connection.detail}</p> : null}
    {connection.lastSyncedAt ? <p className={styles.timestamp}>{G.lastRead(formatEvidenceTimestamp(connection.lastSyncedAt) ?? connection.lastSyncedAt)}</p> : null}
    <div className={styles.actions}>{linked ? <>
      <Button variant="outline" disabled={busy} onClick={onRefresh} aria-label={`${G.refresh}: ${name}`}><RefreshCw size={14} aria-hidden />{G.refresh}</Button>
      <Button variant="ghost" disabled={busy} onClick={onDisconnect} aria-label={`${G.disconnect} ${name}`}>{G.disconnect}</Button>
    </> : <Button variant="brand" disabled={busy} onClick={onConnect} aria-label={`${reconnect ? G.reconnect : G.connect} ${name}`}>{reconnect ? G.reconnect : G.connect} {title}</Button>}</div>
  </SiteSettingsSection>
}
