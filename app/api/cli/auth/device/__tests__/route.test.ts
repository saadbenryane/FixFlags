import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createCliDeviceAuthorization = vi.hoisted(() => vi.fn())
vi.mock('@/lib/cli/device-auth', () => ({ createCliDeviceAuthorization }))
vi.mock('@/lib/get-app-url', () => ({
  getAppUrl: () => 'https://fixflags.test',
}))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))

import { POST } from '@/app/api/cli/auth/device/route'

describe('POST /api/cli/auth/device', () => {
  it('starts a ten-minute one-time browser authorization', async () => {
    createCliDeviceAuthorization.mockResolvedValue({
      deviceCode: 'secret-device-code',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://fixflags.test/cli/authorize',
      verificationUriComplete:
        'https://fixflags.test/cli/authorize?user_code=ABCD-EFGH',
      expiresIn: 600,
      interval: 5,
    })
    const response = await POST(
      new NextRequest('https://fixflags.test/api/cli/auth/device', {
        method: 'POST',
      })
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.expiresIn).toBe(600)
    expect(body.userCode).toBe('ABCD-EFGH')
    expect(createCliDeviceAuthorization).toHaveBeenCalledWith(
      'https://fixflags.test'
    )
  })
})
