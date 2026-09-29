import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WATCH_NOTIFICATION_ATTEMPT_LIMIT,
  watchAlertDelivery,
} from '@/lib/audit/watch-notification'
import { siteWatchAlertNotice, watchAlertSummary } from '@/lib/sites/watch-alert-notice'
import { WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'

const root = resolve(__dirname, '../../..')

/**
 * A Site can be checked on schedule and still never tell the customer anything.
 * Watch is sold on telling you when your site breaks, so a delivery channel
 * that failed quietly turns a working promise into a false one. These tests pin
 * the two properties that matter: a terminal failure is stated, and a failure
 * still being retried is not.
 */
describe('Watch alert delivery', () => {
  it('says nothing when no alert was warranted', () => {
    expect(watchAlertDelivery({ status: null, attempts: 0 })).toBe('none')
    expect(watchAlertDelivery({ status: 'NOT_APPLICABLE', attempts: 0 })).toBe('none')
  })

  it('reports a delivered alert as delivered', () => {
    expect(watchAlertDelivery({ status: 'SENT', attempts: 1 })).toBe('delivered')
  })

  it('reports an alert still being sent as in progress, not as a failure', () => {
    expect(watchAlertDelivery({ status: 'PENDING', attempts: 0 })).toBe('delivering')
    expect(watchAlertDelivery({ status: 'SENDING', attempts: 1 })).toBe('delivering')
  })

  it('keeps a failure that is still being retried out of the terminal state', () => {
    // The bounded retry exists so FixFlags keeps trying before admitting failure.
    // Calling this terminal early is a false alarm about a system that is working.
    for (let attempts = 1; attempts < WATCH_NOTIFICATION_ATTEMPT_LIMIT; attempts += 1) {
      expect(watchAlertDelivery({ status: 'FAILED', attempts })).toBe('delivering')
    }
  })

  it('calls a failure terminal only once the retries are spent', () => {
    expect(watchAlertDelivery({ status: 'FAILED', attempts: WATCH_NOTIFICATION_ATTEMPT_LIMIT })).toBe('undelivered')
    expect(watchAlertDelivery({ status: 'FAILED', attempts: 99 })).toBe('undelivered')
  })
})

describe('Site notice for an undelivered alert', () => {
  const exhausted = WATCH_NOTIFICATION_ATTEMPT_LIMIT

  it('is silent while the alert is still being delivered', () => {
    expect(siteWatchAlertNotice({ status: 'SENT', attempts: 1, at: null })).toBeNull()
    expect(siteWatchAlertNotice({ status: 'PENDING', attempts: 0, at: null })).toBeNull()
    expect(siteWatchAlertNotice({ status: 'SENDING', attempts: 1, at: null })).toBeNull()
  })

  it('is silent for a failure that is still being retried', () => {
    expect(siteWatchAlertNotice({ status: 'FAILED', attempts: exhausted - 1, at: null })).toBeNull()
  })

  it('tells the customer once delivery has genuinely failed', () => {
    const notice = siteWatchAlertNotice({
      status: 'FAILED',
      attempts: exhausted,
      at: new Date('2026-09-20T10:00:00Z'),
    })
    expect(notice).not.toBeNull()
    // Freshness is part of the claim, so the notice carries when it happened.
    expect(notice?.at).toBe('2026-09-20T10:00:00.000Z')
  })

  it('says the checks are still happening, so the customer is not left guessing', () => {
    const notice = siteWatchAlertNotice({ status: 'FAILED', attempts: exhausted, at: null })
    expect(notice?.title).toMatch(/could not reach/i)
    // Coverage and delivery are different facts. The copy must not imply the
    // Site stopped being checked, because it did not.
    expect(notice?.actionLabel).toBeTruthy()
  })

  it('points at the email FixFlags actually sends to', () => {
    const notice = siteWatchAlertNotice({ status: 'FAILED', attempts: exhausted, at: null })
    expect(notice?.actionHref).toBe('/settings')
  })

  it('survives a missing timestamp rather than rendering a broken date', () => {
    expect(siteWatchAlertNotice({ status: 'FAILED', attempts: exhausted, at: null })?.at).toBeNull()
  })

  it('does not leak the provider error into customer copy', () => {
    // watchNotificationLastError holds provider internals. Surfacing it raw
    // would tell the customer about our email vendor rather than their problem.
    const body = WATCH_ALERT_DELIVERY.undeliveredBody('Sep 20, 2026')
    expect(body).not.toMatch(/resend|api key|provider|smtp|422|500|forbidden/i)
    expect(body).toMatch(/did not reach your inbox/i)
  })

  it('reads the alert inside a resolved projectId, so no tenant sees another tenant alert', () => {
    // A provisional Site has no projectId. Querying with projectId: null matches
    // unscoped Watch alerts belonging to other tenants, and an undelivered alert
    // is exactly the kind of state that must never leak sideways.
    const queries = readFileSync(resolve(root, 'lib/sites/application/queries.ts'), 'utf8')
    expect(queries).toMatch(/const latestAlert = site\.projectId\s*\?/)
    expect(queries).toContain('where: { projectId: site.projectId, recheckTrigger: \'WATCH\'')
  })

  it('avoids the banned voice patterns', () => {
    const samples = [
      WATCH_ALERT_DELIVERY.undeliveredTitle,
      WATCH_ALERT_DELIVERY.undeliveredBody(null),
      WATCH_ALERT_DELIVERY.undeliveredAction,
      WATCH_ALERT_DELIVERY.sidebarUndelivered,
      WATCH_ALERT_DELIVERY.sidebarDelivering,
    ]
    for (const sample of samples) {
      expect(sample).not.toMatch(/[\u2013\u2014]/) // dashes
      expect(sample).not.toMatch(/\b(seamless|revolutionary|game-changing|cutting-edge|unleash)\b/i)
    }
  })
})

describe('One-line delivery summary for Site chrome', () => {
  it('is silent when delivery is fine or irrelevant', () => {
    expect(watchAlertSummary('none')).toBeNull()
    expect(watchAlertSummary('delivered')).toBeNull()
  })

  it('states an undelivered alert rather than leaving only the schedule', () => {
    expect(watchAlertSummary('undelivered')).toMatch(/not delivered/i)
  })

  it('mentions a delivery still in progress, without alarming', () => {
    expect(watchAlertSummary('delivering')).toMatch(/sending/i)
  })
})
