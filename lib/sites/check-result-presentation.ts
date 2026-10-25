import type { SiteCheckResult } from './check-results'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'

/** Explain an observation without turning missing evidence into a defect or a pass. */
export function presentCheckResult(result: SiteCheckResult) {
  const original = { name: result.name, observation: result.observation }
  if (result.area !== 'tracking' || result.source !== 'browser-network' || result.status !== 'unknown') return original
  if (result.reason === 'tracking_no_library') return { name: C.tracking.library, observation: C.tracking.noActivity }
  if (result.reason === 'tracking_no_event') return { name: C.tracking.activity, observation: C.tracking.noActivity }
  if (result.reason === 'tracking_provider_unverified') return { name: C.tracking.recording, observation: C.tracking.noRecording }
  if (result.reason === 'tracking_suppressed')
    return { name: C.tracking.delivery, observation: C.tracking.suppressed }
  return original
}
