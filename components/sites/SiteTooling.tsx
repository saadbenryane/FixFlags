import { InteractiveButton } from '@/components/ui/interactive-controls'
import Image from 'next/image'
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

export type { ToolItem, ToolState } from '@/lib/sites/board-types'
import type { ToolItem } from '@/lib/sites/board-types'

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

export function ToolLogo({ name }: { name: string }) {
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
      {items.map(item => {
        const content = <><span aria-hidden="true"><ToolLogo name={item.name} /></span>
          <span className={styles.technologyName}>{item.name}</span>
          <i className={`${styles.statusDot} ${item.state === 'attention' ? styles.attention : ''}`} aria-hidden="true" />
          <span className="sr-only">{item.status}</span></>
        return <li key={item.name} title={`${item.name}: ${item.status}`}>
          {onSelect ? <InteractiveButton type="button" className={styles.technologyItem} onClick={() => onSelect(item)} aria-label={`${item.name}: ${item.status}`}>{content}</InteractiveButton>
            : <span className={styles.technologyItem}>{content}</span>}
        </li>
      })}
    </ul>
  </section>
}
