import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { RETIRED_FUNNEL_EVENTS } from '@/lib/analytics/events'
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

  it('has a current caller for every active event while retaining retired names', () => {
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
      if ((RETIRED_FUNNEL_EVENTS as readonly string[]).includes(event)) continue
      assert.ok(
        (sites.get(event)?.length ?? 0) > 0,
        `${event} should have a call site`,
      )
    }
    for (const event of RETIRED_FUNNEL_EVENTS) {
      assert.ok(parseFunnelEvents().includes(event), `${event} must retain its historical identity`)
      assert.deepEqual(sites.get(event), [], `${event} must not be emitted by a current caller`)
    }
  })
})
