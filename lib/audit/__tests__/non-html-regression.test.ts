import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PageSpeedResult } from '@/lib/audit/pagespeed'
import type { NetworkFailureRecord } from '@/lib/audit/browser/network-monitor'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { runNetworkEngagementChecks } from '@/lib/audit/checks/network-engagement'
import { runOverlayBlockerChecks } from '@/lib/audit/checks/overlay'
import { flowCheckIdForStatus } from '@/lib/audit/flow/flow-evidence'

interface Fixture {
  desktopPageSpeed: PageSpeedResult
  mobilePageSpeed: PageSpeedResult
  networkFailures: NetworkFailureRecord[]
  overlay: Parameters<typeof runOverlayBlockerChecks>[1]
  expectedCheckIds: string[]
}

describe('non-HTML regression fixture', () => {
  it('freezes PageSpeed, network, overlay, and flow findings together', () => {
    const fixture = JSON.parse(readFileSync(
      'lib/audit/__tests__/fixtures/non-html-regression.json',
      'utf8',
    )) as Fixture
    const checkIds = [
      ...runPerformanceChecks(fixture.desktopPageSpeed, fixture.mobilePageSpeed),
      ...runNetworkEngagementChecks(fixture.networkFailures),
      ...runOverlayBlockerChecks('cta', fixture.overlay, 'Start free'),
    ].map((flag) => flag.checkId)
    const flowCheckId = flowCheckIdForStatus('dead_end')
    if (flowCheckId) checkIds.push(flowCheckId)

    expect(checkIds.sort()).toEqual(fixture.expectedCheckIds)
  })

  it('freezes mobile-only poor performance thresholds', () => {
    const desktop: PageSpeedResult = {
      strategy: 'desktop',
      score: 88,
      lcp: 1800,
      cls: 0.04,
      fcp: 1200,
      tbt: 120,
      inp: null,
      opportunities: [],
      failedAccessibilityAudits: [],
      diagnostics: {},
    }
    const mobile: PageSpeedResult = {
      strategy: 'mobile',
      score: 52,
      lcp: 5200,
      cls: 0.18,
      fcp: 2800,
      tbt: 700,
      inp: 420,
      opportunities: [],
      failedAccessibilityAudits: [],
      diagnostics: {},
    }
    const checkIds = runPerformanceChecks(desktop, mobile).map((flag) => flag.checkId).sort()
    expect(checkIds).toEqual(['inp-poor'])
  })
})
