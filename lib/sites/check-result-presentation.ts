import type { SiteCheckResult } from './check-result-contract'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import type { SiteCardArea } from './card-areas'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

/** A recorded collector identifies the source. An installed library or a
 * connection's authorization state does not establish provider evidence. */
export function checkResultSourceLabel(source: string, area: SiteCardArea): string | null {
  if (area === 'search' && Object.hasOwn(SEARCH_COPY.sources, source))
    return SEARCH_COPY.sources[source as keyof typeof SEARCH_COPY.sources]
  if (source === 'http' || source === 'original-html') return SEARCH_COPY.sources[source]
  if (['pagespeed-desktop', 'pagespeed-mobile'].includes(source)) return SITE_BOARD_COPY.pageSpeedSource
  if (['rendered-dom', 'browser-network', 'browser-console', 'browser-accessibility', 'axe', 'keyboard'].includes(source))
    return SITE_BOARD_COPY.browserSource
  return null
}

export function recordedCheckSources(results: readonly SiteCheckResult[], area: SiteCardArea): string[] {
  return [...new Set(results.filter(result => result.area === area && !result.historical && result.kind === 'assertion' &&
    ['passed', 'findings', 'observed'].includes(result.status)).flatMap(result => {
    const label = checkResultSourceLabel(result.source, area)
    return label ? [label] : []
  }))]
}

/** Explain an observation without turning missing evidence into a defect or a pass. */
export function presentCheckResult(result: SiteCheckResult) {
  const original = { name: result.name, observation: result.observation }
  if (result.area !== 'tracking' || result.source !== 'browser-network' || result.status !== 'unknown') return original
  if (result.reason === 'tracking_no_library') return { name: C.tracking.library, observation: C.tracking.noActivity }
  if (result.reason === 'tracking_no_event') return { name: C.tracking.activity, observation: C.tracking.noActivity }
  if (result.reason === 'tracking_provider_unverified' && result.assertionKey === 'tracking-provider-recording')
    return { name: C.tracking.recording, observation: C.tracking.noRecording }
  if (result.reason === 'tracking_suppressed')
    return { name: C.tracking.delivery, observation: C.tracking.suppressed }
  return original
}
