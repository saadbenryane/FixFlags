import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BOARD_PREVIEW_COPY as C } from '@/lib/marketing/copy/board-preview'
import type { SimpleIcon } from 'simple-icons'
import {
  siAngular,
  siAstro,
  siCloudflare,
  siContentful,
  siFirebase,
  siFramer,
  siGatsby,
  siGithub,
  siGoogleanalytics,
  siIntercom,
  siMixpanel,
  siNetlify,
  siNextdotjs,
  siNuxt,
  siPaddle,
  siPosthog,
  siReact,
  siRemix,
  siSanity,
  siSentry,
  siShopify,
  siSquarespace,
  siStripe,
  siSvelte,
  siVercel,
  siVuedotjs,
  siWebflow,
  siWix,
  siWordpress,
} from 'simple-icons'
import styles from './SiteTooling.module.css'

export type ToolState = 'healthy' | 'attention'

export type ToolItem = {
  name: string
  detail?: string
  state: ToolState
  status: string
  suggested?: boolean
  actionHref?: string
  actionDisabled?: boolean
}

const ICONS: Record<string, SimpleIcon> = {
  Angular: siAngular,
  Astro: siAstro,
  Cloudflare: siCloudflare,
  Contentful: siContentful,
  Firebase: siFirebase,
  Framer: siFramer,
  Gatsby: siGatsby,
  GitHub: siGithub,
  'Google Analytics': siGoogleanalytics,
  Intercom: siIntercom,
  Mixpanel: siMixpanel,
  Netlify: siNetlify,
  'Next.js': siNextdotjs,
  Nuxt: siNuxt,
  Paddle: siPaddle,
  PostHog: siPosthog,
  React: siReact,
  Remix: siRemix,
  Sanity: siSanity,
  Sentry: siSentry,
  Shopify: siShopify,
  Squarespace: siSquarespace,
  Stripe: siStripe,
  Svelte: siSvelte,
  SvelteKit: siSvelte,
  Vercel: siVercel,
  Vue: siVuedotjs,
  Webflow: siWebflow,
  Wix: siWix,
  WordPress: siWordpress,
}

const LOCAL_LOGOS: Record<string, string> = {
  GitHub: '/brand/integrations/github.svg',
  'Google Analytics': '/brand/integrations/google-analytics.svg',
  'Google Search Console': '/brand/integrations/google-search-console.svg',
  Shopify: '/brand/integrations/shopify.svg',
}

function ToolLogo({ name }: { name: string }) {
  const local = LOCAL_LOGOS[name]
  if (local) return <span className={styles.toolLogo}><Image src={local} alt="" width={24} height={24} /></span>
  const icon = ICONS[name]
  if (icon) return <span className={styles.toolLogo}><svg viewBox="0 0 24 24" role="img" aria-label={`${name} logo`} style={{ color: `#${icon.hex}` }}><path fill="currentColor" d={icon.path} /></svg></span>
  return <span className={`${styles.toolLogo} ${styles.toolFallback}`} aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
}

export function TechnologyStrip({ items, label = 'Built with', onSelect }: { items: readonly ToolItem[]; label?: string | null; onSelect?: (item: ToolItem) => void }) {
  if (items.length === 0) return null
  return <section className={styles.technologyStrip} aria-label={label ?? 'Detected technologies'}>
    {label ? <span className={styles.technologyLabel}>{label}</span> : null}
    <ul className={styles.technologyList}>
      {items.map(item => <li key={item.name} title={`${item.name}: ${item.status}`}>
        <button type="button" className={styles.technologyItem} onClick={() => onSelect?.(item)} disabled={!onSelect} aria-label={`${item.name}: ${item.status}`}>
        <ToolLogo name={item.name} />
        <span className={styles.technologyName}>{item.name}</span>
        <i className={`${styles.statusDot} ${item.state === 'attention' ? styles.attention : ''}`} aria-hidden="true" />
        <span className="sr-only">{item.status}</span>
        </button>
      </li>)}
    </ul>
  </section>
}

export function IntegrationList({ items, label = 'Integrations', onAction }: { items: readonly ToolItem[]; label?: string; onAction?: (item: ToolItem) => void }) {
  const connected = items.filter(item => item.status === C.connected)
  const suggested = items.filter(item => item.status !== C.connected && item.suggested)
  const other = items.filter(item => item.status !== C.connected && !item.suggested)
  const rows = (group: readonly ToolItem[]) => (
    <ul className={styles.integrationList}>
      {group.map(item => {
        const isConnected = item.status === C.connected
        const action = <>{isConnected ? <Settings2 size={14} aria-hidden /> : null}{isConnected ? C.settings : C.connect}</>
        const aria = isConnected ? C.settingsFor(item.name) : C.connectTool(item.name)
        return <li key={item.name} className={styles.integrationItem}>
        <ToolLogo name={item.name} />
        <span className={styles.integrationCopy}><strong>{item.name}</strong>{item.detail ? <span>{item.detail}</span> : null}</span>
        <span className={styles.integrationActions}>
          {isConnected ? <span className={styles.integrationStatus}><i className={styles.statusDot} aria-hidden />{C.connected}</span> : null}
          {item.actionHref && !item.actionDisabled && !onAction ? <Button size="sm" variant="outline" className="min-h-11" asChild><Link href={item.actionHref as Route} aria-label={aria}>{action}</Link></Button>
            : <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={aria} disabled={item.actionDisabled || (!onAction && !item.actionHref)} onClick={() => onAction?.(item)}>{action}</Button>}
        </span>
      </li>})}
    </ul>
  )
  return <section aria-label={label}>
    {connected.length ? rows(connected) : null}
    {suggested.length ? <div className={styles.integrationGroup}><h3>{C.suggested}</h3>{rows(suggested)}</div> : null}
    {other.length ? <div className={styles.integrationGroup}>{suggested.length || connected.length ? <h3>{C.otherIntegrations}</h3> : null}{rows(other)}</div> : null}
  </section>
}
