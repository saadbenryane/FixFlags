import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  findFunnelCallSites,
  missingFunnelCallSites,
  parseFunnelEvents,
} from '@/lib/analytics/funnel-call-sites'

describe('funnel call sites', () => {
  it('parses every FunnelEvent from the registry', () => {
    const events = parseFunnelEvents()
    assert.ok(events.length >= 30, `expected a full funnel registry, got ${events.length}`)
    assert.ok(events.includes('started_audit'))
    assert.ok(events.includes('viewed_report'))
    assert.ok(events.includes('marketing_page_view'))
  })

  it('has at least one call site for every FunnelEvent', () => {
    const missing = missingFunnelCallSites()
    const sites = findFunnelCallSites()
    assert.deepEqual(
      missing,
      [],
      missing.length
        ? `Missing trackEvent call sites:\n${missing
            .map((event) => `- ${event}`)
            .join('\n')}`
        : undefined,
    )

    for (const event of parseFunnelEvents()) {
      assert.ok(
        (sites.get(event)?.length ?? 0) > 0,
        `${event} should have a call site`,
      )
    }
  })
})
