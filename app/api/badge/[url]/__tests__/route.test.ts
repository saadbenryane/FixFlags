import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFindFirst, mockEnforceRateLimit } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findFirst: mockFindFirst },
  },
}))

vi.mock('@/lib/security/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security/rate-limit')>()
  return {
    ...actual,
    enforceRateLimit: mockEnforceRateLimit,
  }
})

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { RateLimitError } from '@/lib/security/rate-limit'
import { GET } from '../route'

function callBadge(rawUrl: string) {
  return GET(
    new NextRequest(`http://localhost/api/badge/${encodeURIComponent(rawUrl)}`, {
      headers: { 'x-forwarded-for': '203.0.113.20' },
    }),
    { params: Promise.resolve({ url: encodeURIComponent(rawUrl) }) }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnforceRateLimit.mockResolvedValue(undefined)
  mockFindFirst.mockResolvedValue(null)
})

describe('GET /api/badge/[url]', () => {
  it('does not query audits for an invalid domain', async () => {
    const response = await callBadge('https://')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('looks up only the exact normalized domain and uses shared grading', async () => {
    mockFindFirst.mockResolvedValue({
      rubrics: [{ score: 95 }, { score: 85 }, { score: 90 }],
    })

    const response = await callBadge('https://www.Example.com/pricing')
    const svg = await response.text()

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        normalizedDomain: 'example.com',
      },
      orderBy: { completedAt: 'desc' },
      include: { rubrics: { select: { score: true } } },
    })
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>90/100</text>')
  })

  it('returns the shared 429 contract when the badge limit is exceeded', async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitError(9))

    const response = await callBadge('https://example.com')

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('9')
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' })
    expect(mockFindFirst).not.toHaveBeenCalled()
  })
})
