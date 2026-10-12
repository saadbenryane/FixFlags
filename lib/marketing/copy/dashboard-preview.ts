import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import type { PublicConnection } from '@/lib/sites/connections/match'
import { uptimeTimeline, type UptimeHistory, type UptimeProbeView } from '@/lib/uptime/domain'

export const DASHBOARD_PREVIEW_COPY = {
  sample: 'Example website. Changes stay in this preview.',
  accountSample: 'Example website. Account changes stay in this preview.',
  checkedAt: '2026-09-14T09:00:00.000Z',
  shop: 'everyday-goods.myshopify.com',
  findings: '3 Flags need attention.',
  connected: (name: string) => `${name} connected in this preview.`,
  disconnected: (name: string) => `${name} disconnected in this preview.`,
  refreshed: 'Sample context refreshed.',
  retested: 'Sample account check completed.',
  cleanedUp: 'Sample test accounts deleted.',
  accountResult: 'The sample test account reached its signed-in page.',
  accountCleanupResult: 'Deletion of the sample test account was verified.',
} as const

export const SAMPLE_GOOGLE_CONNECTIONS: Record<'SEARCH_CONSOLE' | 'ANALYTICS', PublicConnection> = {
  SEARCH_CONSOLE: { provider: 'SEARCH_CONSOLE', configured: true, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
  ANALYTICS: { provider: 'ANALYTICS', configured: true, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
}

export const SAMPLE_ACCOUNT_CHECKS: AccountChecksView = {
  enabled: true, eligible: true, ready: true, reason: DASHBOARD_PREVIEW_COPY.accountSample, accounts: [], results: [],
}

const sampleUptimeEnd = Date.parse(DASHBOARD_PREVIEW_COPY.checkedAt)
const sampleUptimeUrl = 'https://www.examplesites.com/'
const sampleProbes: UptimeProbeView[] = Array.from({ length: 288 }, (_, index) => {
  const at = new Date(sampleUptimeEnd - (287 - index) * 5 * 60_000).toISOString()
  const failed = index >= 260 && index < 266
  return { id: `sample-probe-${index}`, scheduledAt: at, observedAt: at, attempt: 1, confirmed: failed,
    targetUrl: sampleUptimeUrl, finalUrl: sampleUptimeUrl, result: failed ? 'FAILED' : 'ONLINE', reason: failed ? 'response_error' : 'response_received', statusCode: failed ? 503 : 200, durationMs: failed ? 820 : 180,
  }
})

export function sampleUptimeHistory(window: UptimeHistory['window']): UptimeHistory {
  return { enabled: true, targetUrl: sampleUptimeUrl, state: 'online', lastCheckedAt: DASHBOARD_PREVIEW_COPY.checkedAt,
    nextCheckAt: new Date(sampleUptimeEnd + 5 * 60_000).toISOString(), openIncidentCount: 0,
    segments: uptimeTimeline(sampleProbes, new Date(sampleUptimeEnd), window), window, probes: sampleProbes.slice(-12).toReversed(),
    incidents: [{ id: 'sample-incident', targetUrl: sampleUptimeUrl, startedAt: sampleProbes[260].observedAt, confirmedAt: sampleProbes[260].observedAt, recoveredAt: sampleProbes[266].observedAt, supersededAt: null, reason: 'response_error' }], nextCursor: null,
  }
}

export const SAMPLE_UPTIME = sampleUptimeHistory('24h')
