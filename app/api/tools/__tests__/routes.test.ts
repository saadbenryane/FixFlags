import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckMetaPreview, mockDetectPlaceholders, mockEnforceRateLimit } = vi.hoisted(() => ({
  mockCheckMetaPreview: vi.fn(),
  mockDetectPlaceholders: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}))

vi.mock('@/lib/tools/meta-preview', () => ({
  checkMetaPreview: mockCheckMetaPreview,
}))

vi.mock('@/lib/tools/placeholder-detector', () => ({
  detectPlaceholders: mockDetectPlaceholders,
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
import { POST as postMetaPreview } from '../meta-preview/route'
import { POST as postPlaceholderDetector } from '../placeholder-detector/route'

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnforceRateLimit.mockResolvedValue(undefined)
})

describe('public tool routes', () => {
  it.each([
    ['/api/tools/meta-preview', postMetaPreview],
    ['/api/tools/placeholder-detector', postPlaceholderDetector],
  ] as const)('%s rejects an exceeded rate limit with retry metadata', async (path, handler) => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitError(17))

    const response = await handler(request(path, { url: 'https://example.com' }))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('17')
    await expect(response.json()).resolves.toMatchObject({
      code: 'RATE_LIMITED',
      action: 'retry',
    })
  })

  it('returns a meta preview after applying the shared public-tool limit', async () => {
    mockCheckMetaPreview.mockResolvedValue({ title: 'Example' })

    const response = await postMetaPreview(
      request('/api/tools/meta-preview', { url: 'https://example.com' })
    )

    expect(response.status).toBe(200)
    expect(mockEnforceRateLimit).toHaveBeenCalledWith({
      scope: 'tool-meta-preview',
      identifier: '203.0.113.10',
      limit: 20,
      windowSeconds: 60,
    })
    await expect(response.json()).resolves.toEqual({ title: 'Example' })
  })

  it('returns placeholder findings after applying the shared public-tool limit', async () => {
    mockDetectPlaceholders.mockResolvedValue({ findings: [] })

    const response = await postPlaceholderDetector(
      request('/api/tools/placeholder-detector', { url: 'https://example.com' })
    )

    expect(response.status).toBe(200)
    expect(mockEnforceRateLimit).toHaveBeenCalledWith({
      scope: 'tool-placeholder-detector',
      identifier: '203.0.113.10',
      limit: 20,
      windowSeconds: 60,
    })
    await expect(response.json()).resolves.toEqual({ findings: [] })
  })
})
