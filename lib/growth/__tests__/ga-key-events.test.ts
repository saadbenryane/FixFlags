import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { findFunnelCallSites, parseFunnelEvents } from '@/lib/analytics/funnel-call-sites'
import { GA4_KEY_EVENTS } from '@/lib/growth/ga-key-events'

describe('GA4 key events', () => {
  it('lists only registered funnel events with call sites', () => {
    const funnelEvents = new Set(parseFunnelEvents())
    const callSites = findFunnelCallSites()

    for (const event of GA4_KEY_EVENTS) {
      assert.ok(
        funnelEvents.has(event),
        `${event} must exist in FunnelEvent before marking as GA4 key event`,
      )
      assert.ok(
        (callSites.get(event)?.length ?? 0) > 0,
        `${event} must have a client call site before marking as GA4 key event`,
      )
    }
  })

  it('covers the anonymous signup conversion path', () => {
    const anonPath = [
      'started_audit',
      'viewed_report',
      'report_signup_cta_clicked',
      'signed_up',
      'audits_claimed',
      'fix_prompt_copied',
    ] as const

    for (const event of anonPath) {
      assert.ok(
        (GA4_KEY_EVENTS as readonly string[]).includes(event),
        `${event} should be a GA4 key event for anon funnel attribution`,
      )
    }
  })
})
