/** Finite public labels. Never accept a browsing URL as an entry value. */
export const WEBSITE_GUIDE_SLUGS = [
  'monitoring-ai-built-websites',
  'checking-after-publishing',
  'website-online-but-not-working',
  'checking-lovable-websites',
  'fixflags-vs-uptime-monitoring',
  'fixflags-vs-scripted-browser-monitoring',
] as const

export const GUIDE_INDEX_ENTRY = 'guides-index'
export const GUIDE_ANALYZE_EVENT = 'guide_analyze_clicked'
export type WebsiteGuideSlug = typeof WEBSITE_GUIDE_SLUGS[number]
export type GuideEntry = WebsiteGuideSlug | typeof GUIDE_INDEX_ENTRY
export const GUIDE_ENTRY_PARAM = 'ff_guide'
const guideEntries: ReadonlySet<string> = new Set([GUIDE_INDEX_ENTRY, ...WEBSITE_GUIDE_SLUGS])

export function isGuideEntry(value: unknown): value is GuideEntry {
  return typeof value === 'string' && guideEntries.has(value)
}

export function withGuideEntry(path: string, page: string): string {
  const entry = page === '/guides' ? GUIDE_INDEX_ENTRY : page.startsWith('/guides/') ? page.slice('/guides/'.length) : null
  return isGuideEntry(entry) ? `${path}${path.includes('?') ? '&' : '?'}${GUIDE_ENTRY_PARAM}=${entry}` : path
}

export function readGuideEntry(params: URLSearchParams): GuideEntry | undefined {
  const entries = params.getAll(GUIDE_ENTRY_PARAM)
  return entries.length === 1 && isGuideEntry(entries[0]) ? entries[0] : undefined
}
