import { afterEach, describe, expect, it, vi } from 'vitest'
import { siteNotificationEmail } from '../site-notification'
import { brandLight } from '@/lib/design/brand-spec'
import { DEMO_EMAILS, KEEP_REPORT_EMAIL, NURTURE_EMAILS } from '../templates'
import { load } from 'cheerio'

describe('combined Site notification', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns to the originating app instead of sending verification customers to production', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.fixflags.test/')
    const message = siteNotificationEmail({ projectId: 'site-1', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'flag-1', problem: 'The observed failure' }], recoveries: [] })
    const evidence = 'https://validation.fixflags.test/sites/site-1/flags/flag-1?source=watch-email'
    expect(message.html).toContain(evidence)
    expect(message.text).toContain(evidence)
    expect(message.html).not.toContain('https://fixflags.com/sites/')
  })
  it('escapes customer fields exactly once and keeps onboarding claims consistent with beta access', () => {
    const confirmation = DEMO_EMAILS.confirm.html('R&D <team>', 'Studio')
    expect(confirmation).toContain('R&amp;D &lt;team&gt;')
    expect(confirmation).not.toContain('&amp;amp;')
    const welcome = NURTURE_EMAILS.welcome.html('Owner')
    expect(welcome).toContain('Keep one website in your free account.')
    expect(welcome).not.toContain('Site checks each month')
    expect(KEEP_REPORT_EMAIL.html('https://fixflags.com/report/id?a=1&b=2')).toContain('a=1&amp;b=2')
  })
  it('includes every actionable finding and verified recovery in one branded message', () => {
    const message = siteNotificationEmail({ projectId: 'site-1', url: 'https://example.com/shop', name: 'Owner',
      checkedAt: new Date('2026-10-13T00:00:00Z'),
      regressions: [{ id: 'checkout', problem: 'Checkout failed' }, { id: 'title', problem: 'Search title is missing' }],
      recoveries: [{ id: 'repaired', problem: 'Image failed to load' }] })
    expect(message.subject).toBe('example.com: 2 problems to review')
    for (const id of ['checkout', 'title', 'repaired']) {
      expect(message.html).toContain(`/sites/site-1/flags/${id}?source=watch-email`)
      expect(message.text).toContain(`/sites/site-1/flags/${id}?source=watch-email`)
    }
    expect(message.html).toContain('What improved')
    expect(message.html).toContain(`background:${brandLight.brand}`)
    expect(message.html).toContain('/icon-192.png')
    expect(message.html).toContain('Checked Oct 13, 2026, 12:00 AM UTC.')
  })
  it('escapes account names, finding text, and links while preserving plain text evidence', () => {
    const message = siteNotificationEmail({ projectId: 'site/<bad>', url: 'https://example.com', name: '<img src=x>', checkedAt: null,
      regressions: [{ id: '<flag>', problem: '<script>Checkout failed</script>' }], recoveries: [] })
    expect(message.html).not.toContain('<script>')
    expect(message.html).not.toContain('<img src=x>')
    expect(message.html).toContain('&lt;script&gt;Checkout failed&lt;/script&gt;')
    expect(message.html).toContain('/site%2F%3Cbad%3E/flags/%3Cflag%3E?')
    expect(message.text).toContain('<script>Checkout failed</script>')
  })
  it('states verified recovery without presenting new failure or missing observations as recovery', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [], recoveries: [{ id: 'fixed', problem: 'The observed failure' }] })
    expect(message.subject).toBe('example.com: 1 problem resolved')
    expect(message.text).toContain('We checked again and did not find this problem.')
    expect(load(message.html)('h2').text()).not.toContain('Needs attention')
    expect(message.text).not.toContain('See what to do next')
    expect(message.text).toContain('View details:')
  })

  it('pairs each old problem with the scoped recheck result in HTML and plain text', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null,
      checkedAt: new Date('2026-11-02T09:00:00Z'), regressions: [],
      recoveries: [{ id: 'image', problem: 'The product image did not load.' }, { id: 'title', problem: 'The page title was missing.' }] })
    const $ = load(message.html)
    const comparisons = $('table').filter((_, el) => $(el).children('tbody').children('tr').length === 2)
    expect(comparisons).toHaveLength(2)
    for (const [index, problem] of ['The product image did not load.', 'The page title was missing.'].entries()) {
      const rows = comparisons.eq(index).find('tr')
      expect(rows.eq(0).text()).toContain(`Before\n${problem}`)
      expect(rows.eq(1).text()).toContain('Now\nWe checked again and did not find this problem.')
      expect(message.text).toContain(`Before\n\n${problem}:`)
    }
    expect(message.subject).toBe('example.com: 2 problems resolved')
    expect(message.text).not.toMatch(/recovery verified|all clear|everything works|we fixed/i)
    expect(message.html).not.toMatch(/<hr\b|border-(top|bottom|left|right):/)
  })

  it('does not invent a passing before state for a newly found problem', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [{ id: 'checkout', problem: 'Checkout failed.' }], recoveries: [] })
    expect(message.text).toContain('Checkout failed.')
    expect(message.text).not.toMatch(/Before|What improved|Found in this check|See what to do next|previously worked/)
    const $ = load(message.html)
    expect($('h2')).toHaveLength(0)
    const action = $('a').filter((_, element) => $(element).text() === 'View details')
    expect(action).toHaveLength(1)
    expect(action.attr('href')).toContain('/sites/site/flags/checkout?source=watch-email')
  })

  it('keeps long notifications bounded and does not silently drop findings with missing copy', () => {
    const message = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: Array.from({ length: 9 }, (_, index) => ({ id: `problem-${index}` })),
      recoveries: [{ id: 'fixed', problem: 'Old problem' }] })
    expect(message.text.match(/A problem needs your attention\./g)).toHaveLength(8)
    expect(message.text).toContain('2 more updates')
    expect(message.html).not.toContain('/flags/problem-8?')
    expect(Buffer.byteLength(message.html)).toBeLessThan(20_000)
    const empty = siteNotificationEmail({ projectId: 'site', url: 'https://example.com', name: null, checkedAt: null,
      regressions: [], recoveries: [] })
    expect(empty.subject).toBe('example.com: Website update')
    expect(empty.text).not.toContain('resolved')
    expect(empty.text).toContain('View website:')
  })
})
