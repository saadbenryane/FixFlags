import type { SiteHomeView } from './site-home'
import type { SiteFlagSeed } from './coverage'
import { compareFlagPriority } from './presentation'

export type PageResultData = {
  url: string; label: string; status: string; capture: { src: string; alt: string } | null;
  flags: Array<Pick<SiteFlagSeed, 'id' | 'problem' | 'priorityBand'>>;
}

/** A single recorded page inventory, projected through an explicitly selected finding scope. */
export function projectPageResults(checked: NonNullable<SiteHomeView['checkedPages']>, flags: SiteFlagSeed[]): PageResultData[] {
  const urls = [...new Set([...checked.map(page => page.url), ...flags.flatMap(flag => flag.affectedPaths.length ? flag.affectedPaths : flag.pageUrl ? [flag.pageUrl] : [])])]
  const paths = new Map<string, URL[]>()
  for (const url of urls) {
    try { const parsed = new URL(url); paths.set(parsed.pathname, [...paths.get(parsed.pathname) ?? [], parsed]) } catch { /* Keep the recorded address. */ }
  }
  return urls.map(url => {
    const recorded = checked.find(page => page.url === url)
    let label = url
    try {
      const parsed = new URL(url), matching = paths.get(parsed.pathname) ?? []
      const multipleHosts = new Set(matching.map(item => item.host)).size > 1
      label = `${multipleHosts ? parsed.host : ''}${parsed.pathname}${matching.length > 1 ? parsed.search + parsed.hash : ''}`
    } catch { /* Keep the recorded address. */ }
    return { url, label, status: recorded?.status ?? 'UNKNOWN',
      capture: recorded?.capture ? { src: recorded.capture.url, alt: recorded.title || url } : null,
      flags: flags.filter(flag => (flag.affectedPaths.length ? flag.affectedPaths : flag.pageUrl ? [flag.pageUrl] : []).includes(url))
        .sort(compareFlagPriority).map(({ id, problem, priorityBand }) => ({ id, problem, priorityBand })) }
  })
}
