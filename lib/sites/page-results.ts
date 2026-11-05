import type { SiteHomeView } from './site-home'
import type { SiteFlagSeed } from './coverage'
import { compareFlagPriority } from './presentation'

export type PageResultData = {
  url: string; label: string; status: string; capture: { src: string; alt: string } | null;
  flags: Array<Pick<SiteFlagSeed, 'id' | 'problem' | 'priorityBand' | 'checkId' | 'fix' | 'area' | 'evidence'>>;
}

/** A single recorded page inventory, projected through an explicitly selected finding scope. */
export function projectPageResults(checked: NonNullable<SiteHomeView['checkedPages']>, flags: SiteFlagSeed[]): PageResultData[] {
  const pages = new Map<string, { recorded?: typeof checked[number]; flags: SiteFlagSeed[]; parsed?: URL }>()
  for (const page of checked) {
    if (!pages.has(page.url)) pages.set(page.url, { recorded: page, flags: [] })
  }
  for (const flag of flags) {
    const affected = flag.affectedPaths.length ? flag.affectedPaths : flag.pageUrl ? [flag.pageUrl] : []
    for (const url of new Set(affected)) {
      let page = pages.get(url)
      if (!page) { page = { flags: [] }; pages.set(url, page) }
      page.flags.push(flag)
    }
  }
  const paths = new Map<string, { count: number; hosts: Set<string> }>()
  for (const [url, page] of pages) {
    try {
      const parsed = new URL(url)
      page.parsed = parsed
      let path = paths.get(parsed.pathname)
      if (!path) { path = { count: 0, hosts: new Set() }; paths.set(parsed.pathname, path) }
      path.count++; path.hosts.add(parsed.host)
    } catch { /* Keep the recorded address. */ }
  }
  return Array.from(pages, ([url, { recorded, parsed, flags: pageFlags }]) => {
    const matching = parsed ? paths.get(parsed.pathname)! : null
    const label = parsed && matching ? `${matching.hosts.size > 1 ? parsed.host : ''}${parsed.pathname}${matching.count > 1 ? parsed.search + parsed.hash : ''}` : url
    return { url, label, status: recorded?.status ?? 'UNKNOWN',
      capture: recorded?.capture ? { src: recorded.capture.url, alt: recorded.title || url } : null,
      flags: pageFlags.sort(compareFlagPriority).map(({ id, problem, priorityBand, checkId, fix, area, evidence }) => ({ id, problem, priorityBand, checkId, fix, area, evidence })) }
  })
}
