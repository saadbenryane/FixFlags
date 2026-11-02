import { afterEach, expect, it, vi } from 'vitest'
import { load } from 'cheerio'
import { uptimeNotificationEmail } from '../uptime-notification'

afterEach(() => vi.unstubAllEnvs())
const input = { projectId: 'site/<id>', url: 'https://example.com/shop?category=books&sort=new',
  at: new Date('2026-11-02T09:00:00Z') }

it('shows what changed after an outage without claiming pages or checkout work', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://validation.example.test')
  const email = uptimeNotificationEmail({ ...input, kind: 'RECOVERED' })
  const $ = load(email.html)
  expect($('h1').text()).toBe('Your website is responding again')
  expect(email.text).toContain('Before\n\nWe could not reach your website.')
  expect(email.text).toContain('Now\n\nYour website responded to our latest check.')
  expect(email.text).toContain('This check does not test page content, forms or checkout.')
  expect(email.text).toContain('Checked Nov 2, 2026, 9:00 AM UTC.')
  expect(email.html).toContain('category=books&amp;sort=new')
  expect(email.text).toContain(input.url)
  expect(email.text).toContain('https://validation.example.test/sites/site%2F%3Cid%3E?view=timeline')
  expect(email.text).not.toMatch(/recovery verified|availability probe|\bHTTP\b|all clear|check your hosting/i)
})

it('explains the failed checks and next step without inventing a previous online observation', () => {
  const email = uptimeNotificationEmail({ ...input, kind: 'DOWN' })
  expect(email.subject).toBe('example.com is not responding')
  expect(email.text).toContain('Now\n\nWe tried twice. Your website did not respond.')
  expect(email.text).toContain('Check your hosting service for an outage or a recent change.')
  expect(email.text).not.toContain('Before')
  expect(email.html).not.toMatch(/<hr\b|border-(top|bottom|left|right):/)
})
