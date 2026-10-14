import type { SiteFlagSeed } from './coverage'
import { SITE_CARD_AREAS, type SiteCardArea } from './card-areas'

export type SiteScopeCounts = {
  flags: number; checkedPages: number; recordedPages: number; savedPages: number;
  categories: Record<SiteCardArea, number>; pages: Record<string, number>;
}
/** Each distinct Flag is counted once per affected page and once in its category. */
export function siteScopeCounts(flags: readonly SiteFlagSeed[], pages: readonly { url: string; status: string }[], savedPages: number): SiteScopeCounts {
  const categories = Object.fromEntries(SITE_CARD_AREAS.map(area => [area, 0])) as Record<SiteCardArea, number>
  const pageCounts: Record<string, number> = Object.fromEntries(pages.map(page => [page.url, 0]))
  for (const flag of flags) {
    categories[flag.area]++
    for (const url of new Set(flag.affectedPaths.length ? flag.affectedPaths : flag.pageUrl ? [flag.pageUrl] : []))
      pageCounts[url] = (pageCounts[url] ?? 0) + 1
  }
  return { flags: flags.length, checkedPages: pages.filter(page => page.status === 'COMPLETED').length,
    recordedPages: pages.length, savedPages, categories, pages: pageCounts }
}
