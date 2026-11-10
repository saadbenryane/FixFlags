import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { findBrokenLinks, enforceRateLimit } = vi.hoisted(() => ({ findBrokenLinks: vi.fn(), enforceRateLimit: vi.fn() }))
vi.mock('@/lib/tools/broken-links', () => ({ findBrokenLinks }))
vi.mock('@/lib/security/rate-limit', async importOriginal => ({ ...await importOriginal<object>(), enforceRateLimit }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
import { RateLimitError } from '@/lib/security/rate-limit'
import { POST } from '../broken-links/route'

const call = (body: string) => POST(new NextRequest('http://localhost/api/tools/broken-links', { method: 'POST', body }))

beforeEach(() => {
  vi.clearAllMocks()
  findBrokenLinks.mockResolvedValue({ url: 'https://shop.com/', checked: 2, skipped: 0, broken: [], error: null })
})

it('rate limits each client more tightly than other tools', async () => {
  await call('{"url":"shop.com"}')
  expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: 'tool-broken-links', limit: 6, windowSeconds: 60 }))
  enforceRateLimit.mockRejectedValueOnce(new RateLimitError(30))
  expect((await call('{"url":"shop.com"}')).status).toBe(429)
})

it('requires a URL and returns the check result', async () => {
  expect((await call('{}')).status).toBe(400)
  expect((await call('not json')).status).toBe(400)
  expect(findBrokenLinks).not.toHaveBeenCalled()
  const response = await call('{"url":"shop.com"}')
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ checked: 2, broken: [] })
  expect(findBrokenLinks).toHaveBeenCalledWith('shop.com')
})
