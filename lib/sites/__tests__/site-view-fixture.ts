import { siteScopeCounts } from '@/lib/sites/scope-counts'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import type { SiteHomeView } from '../application/queries'

export function siteViewFixture(): SiteHomeView {
  return {
    schemaVersion: 2, counts: siteScopeCounts([], [], 0), actions: siteViewerActions(true), inventoryPageCount: 0, activeRuns: [], monitoringHistory: [], monitoringTrend: [],
    site: { siteId: 'fixture-site', kind: 'project', url: 'https://example.com', canonicalHost: 'example.com', name: 'Example',
      projectId: 'fixture-site', provisionalSiteId: null, primaryAuditId: 'audit-1', watchInterval: null,
      watchNextRunAt: null, watchLastRunAt: null, watchLastError: null, watchConsecutiveFailures: 0, userId: 'owner-1' },
    presentation: {
      identity: { siteId: 'fixture-site', name: 'Example', host: 'example.com', preview: null },
      result: { state: 'could_not_verify', label: 'Not verified' }, monitoring: { state: 'not_monitored', label: 'Not monitored' },
      coverage: { pagesReached: 1, pagesExpected: 1, label: '1 page', complete: false },
      freshness: { checkedAt: null, stale: false, label: 'Not verified' }, flags: { count: 0, label: '0 Flags', fixFirstCount: 0 },
      run: { state: 'idle', label: 'Recorded', auditId: 'audit-1', recoveryAction: null }, categories: [],
    },
    audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: false, failureCode: null },
    cards: [], flags: [], recommendations: [], resolvedFlags: [],
    outcomes: [{ id: 'availability-1', name: 'Availability', slug: 'availability', description: null, inferenceSource: 'user',
      confirmedAt: null, pageIds: [], pageUrls: ['https://example.com'], kind: 'AVAILABILITY', criticality: 'IMPORTANT',
      environment: 'production', enabled: true, staleAfterMinutes: 60, expectation: 'Respond successfully', bindings: [],
      coverage: null, state: 'COULD_NOT_VERIFY', summary: 'Verification pending', lastVerifiedAt: null, validUntil: null,
      flagId: null, latestRunId: 'run-1', running: true }],
    watch: { state: 'off', interval: null, nextRunAt: null, lastRunAt: null, lastError: null, covered: false,
      label: 'Not monitored', alert: { state: 'none', status: null, attempts: 0, at: null } },
    settings: { notificationLevel: 'FLAGS', notifyOnRecovery: true, shopify: { configured: false, state: 'not_connected', domain: null },
      searchConsole: { provider: 'SEARCH_CONSOLE', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
      analytics: { provider: 'ANALYTICS', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null } },
  }
}
