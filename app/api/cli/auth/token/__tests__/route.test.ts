import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const exchangeCliDeviceCode = vi.hoisted(() => vi.fn())
vi.mock('@/lib/cli/device-auth', () => ({ exchangeCliDeviceCode }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))

import { POST } from '@/app/api/cli/auth/token/route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/cli/auth/token', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/cli/auth/token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the raw credential only after approval', async () => {
    exchangeCliDeviceCode.mockResolvedValue({
      ok: true,
      accessToken: 'ff_live_once',
      tokenType: 'Bearer',
    })
    const response = await POST(request({ deviceCode: 'device-code' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      accessToken: 'ff_live_once',
      tokenType: 'Bearer',
    })
  })

  it.each([
    ['AUTHORIZATION_PENDING', 428],
    ['SLOW_DOWN', 429],
    ['ACCESS_DENIED', 403],
    ['EXPIRED_DEVICE_CODE', 410],
    ['DEVICE_CODE_ALREADY_USED', 409],
  ])('maps %s to HTTP %s', async (code, status) => {
    exchangeCliDeviceCode.mockResolvedValue({
      ok: false,
      code,
      ...(code === 'SLOW_DOWN' ? { retryAfter: 5 } : {}),
    })
    const response = await POST(request({ deviceCode: 'device-code' }))
    expect(response.status).toBe(status)
    expect((await response.json()).code).toBe(code)
  })

  it('rejects a missing device code', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
    expect(exchangeCliDeviceCode).not.toHaveBeenCalled()
  })
})
