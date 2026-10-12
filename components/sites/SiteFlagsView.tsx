import { SiteBoard } from './SiteBoard'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { SITE_CARD_AREAS, type SiteCardArea } from '@/lib/sites/card-areas'

export const SITE_FLAG_TABS = ['open', 'resolved'] as const
export type SiteFlagTab = (typeof SITE_FLAG_TABS)[number]
export type SiteFlagCategory = 'all' | SiteCardArea

/**
 * The tab is read on the server, never from `useSearchParams`. This view is a
 * Server Component like `SiteSettingsView`, and only a Client Component may
 * call that hook. An unknown or missing value is the Open attention default,
 * because a mangled URL must never render a blank Flags page.
 */
export function siteFlagTab(value: string | string[] | undefined): SiteFlagTab {
  return SITE_FLAG_TABS.includes(value as SiteFlagTab) ? (value as SiteFlagTab) : 'open'
}

export function siteFlagCategory(value: string | string[] | undefined): SiteFlagCategory {
  return typeof value === 'string' && SITE_CARD_AREAS.includes(value as SiteCardArea)
    ? value as SiteCardArea
    : 'all'
}

export function siteFlagPage(value: string | string[] | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : 1
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

/** Compatibility renderer for old callers. The standalone Flag list is retired. */
export function SiteFlagsView({ siteId, view, tab }: { siteId: string; view: SiteHomeView; tab: SiteFlagTab; category?: SiteFlagCategory; page?: number }) {
  return <SiteBoard siteId={siteId} initial={view} viewMode={tab === 'resolved' ? 'timeline' : 'home'} />
}
