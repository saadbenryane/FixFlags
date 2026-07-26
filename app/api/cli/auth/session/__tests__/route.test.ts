import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const validateApiKey = vi.hoisted(() => vi.fn())
const updateApiKey = vi.hoisted(() => vi.fn())
vi.mock('@/lib/mcp/tools', () => ({ validateApiKey }))
vi.mock('@/lib/db', () => ({ prisma: { apiKey: { update: updateApiKey } } }))

import { DELETE, GET } from '@/app/api/cli/auth/session/route'

function request(method = 'GET') {
  return new NextRequest('http://localhost/api/cli/auth/session', {
    method,
    headers: { Authorization: 'Bearer ff_live_test' },
  })
}

describe('/api/cli/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateApiKey.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'customer@example.com',
        name: 'Customer',
        plan: 'BUILDER',
      },
      apiKey: { id: 'key-1', client: 'cli' },
    })
  })

  it('returns a sanitized CLI identity', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.user.email).toBe('customer@example.com')
    expect(JSON.stringify(body)).not.toContain('ff_live_test')
  })

  it('revokes the current credential', async () => {
    const response = await DELETE(request('DELETE'))
    expect(response.status).toBe(200)
    expect(updateApiKey).toHaveBeenCalledWith({
      where: { id: 'key-1' },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
