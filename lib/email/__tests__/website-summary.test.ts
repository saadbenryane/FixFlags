import { afterEach, expect, it, vi } from 'vitest'
import { websiteSummaryEmail, type SummarySite } from '../website-summary'
import { uptimeNotificationEmail } from '../uptime-notification'
import { load } from 'cheerio'

afterEach(() => vi.unstubAllEnvs())
const site: SummarySite = { id: 'website', url: 'https://example.com', checkedAt: new Date('2026-10-28T08:00:00Z'),
  problems: 0, incomplete: false, failed: false, unchanged: false, offline: false }
it('distinguishes missing, incomplete, old and failing checks without claiming everything is healthy', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.example.test')
  const email = websiteSummaryEmail({ cadence: 'DAILY', asOf: new Date('2026-10-29T09:00:00Z'), timeZone: 'UTC', totalSites: 4,
    sites: [{ ...site, checkedAt: null }, { ...site, incomplete: true }, { ...site, unchanged: true }, { ...site, problems: 3, offline: true }] })
  expect(email.text).toContain('No completed check yet.')
  expect(email.text).not.toContain('Some checks could not finish.')
  expect(email.html).not.toContain('Some checks could not finish.')
  expect(email.text).toContain('No new check since your last summary.')
  expect(email.text).toContain('3 problems to review')
  expect(email.html).toContain('https://validation.example.test/settings#email-updates')
  expect(email.html).not.toMatch(/<script|<style|@font-face|<hr/)
  expect(email.text).not.toContain('All clear')
})
it('shares the last check time without giving limited coverage an all-clear', () => {
  const email = websiteSummaryEmail({ cadence: 'DAILY', sites: [{ ...site, incomplete: true }], totalSites: 1,
    timeZone: 'UTC', asOf: new Date('2026-10-29T09:00:00Z') })
  expect(email.text).toContain('Last checked')
  expect(email.text).not.toMatch(/no problems to review|could not finish/i)
  expect(email.html).not.toMatch(/no problems to review|could not finish/i)
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
it('previews recorded problems and opens the fix list in both email formats', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.example.test')
  const email = websiteSummaryEmail({ cadence: 'DAILY', sites: [{ ...site, id: 'site/<id>', problems: 37,
    issuePreview: ['Images take too much time to load', 'Some links lead to missing pages', 'The contact form has no labels', 'Fourth problem'] }],
    totalSites: 1, timeZone: 'UTC', asOf: new Date('2026-11-10T09:00:00Z') })
  const $ = load(email.html)
  expect($('h1').text()).toBe('Your daily website summary')
  expect($('li').map((_, el) => $(el).text()).get()).toEqual([
    'Images take too much time to load', 'Some links lead to missing pages', 'The contact form has no labels',
  ])
  expect(email.text).toContain('- Images take too much time to load')
  expect(email.text).not.toContain('Fourth problem')
  expect(email.text.match(/37 problems to review/g)).toHaveLength(1)
  const action = $('a').filter((_, el) => $(el).text() === 'View fix prompts')
  expect(action.attr('href')).toBe('https://validation.example.test/sites/site%2F%3Cid%3E/flags?source=summary-email')
  expect(email.text).toContain('View fix prompts: ' + action.attr('href'))
  expect(email.text).toContain('review and copy its fix prompt')
  expect($('a').filter((_, el) => $(el).text() === 'View all websites')).toHaveLength(0)
  expect(email.html).not.toMatch(/<hr\b|border-(top|bottom|left|right):/)
})
it('escapes and bounds previews without inventing issues for quiet websites', () => {
  const email = websiteSummaryEmail({ cadence: 'WEEKLY', sites: [
    { ...site, problems: 2, issuePreview: [' <script>R&D</script> ', '<script>R&D</script>', 'A'.repeat(500), 'Not shown'] },
    { ...site, issuePreview: ['Old issue must not appear'] },
  ], totalSites: 2, timeZone: 'UTC', asOf: new Date() })
  const $ = load(email.html)
  expect($('script')).toHaveLength(0)
  expect($('li')).toHaveLength(2)
  expect($('li').first().text()).toBe('<script>R&D</script>')
  expect($('li').last().text()).toHaveLength(160)
  expect(email.text).not.toMatch(/Old issue must not appear|Not shown/)
  expect(email.html).toContain('&lt;script&gt;R&amp;D&lt;/script&gt;')
  expect(email.text).toContain('Your weekly website summary')
  expect(email.text).toContain('View website:')
})
it('keeps a full account of long previews below inbox clipping limits', () => {
  const email = websiteSummaryEmail({ cadence: 'DAILY', sites: Array.from({ length: 20 }, (_, i) => ({ ...site,
    id: String(i), problems: 37, issuePreview: ['<'.repeat(500), '>'.repeat(500), '&'.repeat(500)] })),
    totalSites: 20, timeZone: 'UTC', asOf: new Date() })
  expect(Buffer.byteLength(email.html)).toBeLessThan(90_000)
  expect(load(email.html)('li')).toHaveLength(60)
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
