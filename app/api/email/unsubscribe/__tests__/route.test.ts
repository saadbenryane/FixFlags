import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const stop = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email/unsubscribe', async original => ({ ...await original<typeof import('@/lib/email/unsubscribe')>(), unsubscribeProductTips: stop }))
import { GET, POST } from '../route'
import { productTipsUnsubscribeUrl } from '@/lib/email/unsubscribe'

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('BETTER_AUTH_SECRET', 'fixture-only-notification-signing-secret-32-characters')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://notification.example.test')
  stop.mockResolvedValue(true)
})
afterEach(() => vi.unstubAllEnvs())
const url = () => productTipsUnsubscribeUrl('owned-user', 'owner@example.test')
it('lets email scanners read the link without changing a preference', async () => {
  const response = await GET(new Request(url()))
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('method="post"')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(stop).not.toHaveBeenCalled()
})
it('processes a signed one-click POST without a session or redirect', async () => {
  const response = await POST(new Request(url(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('Location')).toBeNull()
  expect(await response.text()).toContain('Product tips are off')
  expect(stop).toHaveBeenCalledOnce()
})
it('refuses forged tokens, unintended POST bodies and oversized requests', async () => {
  const valid = url()
  expect((await GET(new Request(valid + 'forged'))).status).toBe(400)
  expect((await POST(new Request(valid, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'confirm=anything' }))).status).toBe(400)
  expect((await POST(new Request(valid, { method: 'POST', body: 'x'.repeat(9000) }))).status).toBe(400)
  expect(stop).not.toHaveBeenCalled()
})
