import { afterEach, expect, it, vi } from 'vitest'
import { websiteSummaryEmail, type SummarySite } from '../website-summary'
import { uptimeNotificationEmail } from '../uptime-notification'

afterEach(() => vi.unstubAllEnvs())
const site: SummarySite = { id: 'website', url: 'https://example.com', checkedAt: new Date('2026-10-28T08:00:00Z'),
  problems: 0, incomplete: false, failed: false, unchanged: false, offline: false }
it('distinguishes missing, incomplete, old and failing checks without claiming everything is healthy', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.example.test')
  const email = websiteSummaryEmail({ cadence: 'DAILY', asOf: new Date('2026-10-29T09:00:00Z'), timeZone: 'UTC', totalSites: 4,
    sites: [{ ...site, checkedAt: null }, { ...site, incomplete: true }, { ...site, unchanged: true }, { ...site, problems: 3, offline: true }] })
  expect(email.text).toContain('No completed check yet.')
  expect(email.text).toContain('Some checks could not finish.')
  expect(email.text).toContain('This website check also appeared in your previous summary.')
  expect(email.text).toContain('3 problems to review')
  expect(email.html).toContain('https://validation.example.test/settings#email-updates')
  expect(email.html).not.toMatch(/<script|<style|@font-face|<hr/)
  expect(email.text).not.toContain('All clear')
})
it('bounds summary size even for accounts with many websites', () => {
  const email = websiteSummaryEmail({ cadence: 'WEEKLY', sites: Array.from({ length: 500 }, () => site),
    totalSites: 500, timeZone: 'UTC', asOf: new Date() })
  expect(Buffer.byteLength(email.html)).toBeLessThan(30_000)
  expect(email.text).toContain('480 more websites')
})
it('does not turn stale results into a current clean bill of health', () => {
  const email = websiteSummaryEmail({ cadence: 'DAILY', sites: [{ ...site, stale: true }], totalSites: 1,
    timeZone: 'UTC', asOf: new Date('2026-10-29T09:00:00Z') })
  expect(email.text).toContain('older than your monitoring schedule')
  expect(email.text).not.toContain('No problems to review')
})
it('gives outage and recovery emails a real button and matching plain text action', () => {
  for (const kind of ['DOWN', 'RECOVERED'] as const) {
    const email = uptimeNotificationEmail({ projectId: 'site/<id>', url: site.url, kind, at: new Date('2026-10-29T09:00:00Z') })
    expect(email.html).toContain('/sites/site%2F%3Cid%3E?view=timeline')
    expect(email.html).toContain('View website status</a>')
    expect(email.text).toContain('View website status:')
    expect(email.text).not.toContain('HTTP')
    expect(Buffer.byteLength(email.html)).toBeLessThan(8_000)
  }
})
