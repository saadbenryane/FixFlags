import { afterEach, describe, expect, it, vi } from 'vitest'
import { siteNotificationEmail } from '../site-notification'
import { brandLight } from '@/lib/design/brand-spec'
import { DEMO_EMAILS, KEEP_REPORT_EMAIL, NURTURE_EMAILS } from '../templates'

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
    expect(message.subject).toBe('Needs attention on example.com: 2 Flags')
    for (const id of ['checkout', 'title', 'repaired']) {
      expect(message.html).toContain(`/sites/site-1/flags/${id}?source=watch-email`)
      expect(message.text).toContain(`/sites/site-1/flags/${id}?source=watch-email`)
    }
    expect(message.html).toContain('Recovery verified')
    expect(message.html).toContain(`background:${brandLight.brand}`)
    expect(message.html).toContain('/icon-192.png')
    expect(message.html).toContain('Checked 2026-10-13T00:00:00.000Z.')
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
    expect(message.subject).toBe('Recovery verified on example.com')
    expect(message.text).toContain('An independent check verified a recovery on example.com.')
    expect(message.html).not.toContain('<h2 style="font-size:16px;">Needs attention</h2>')
  })
})
