import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSafeFetchHtml, mockToolUsageCreate } = vi.hoisted(() => ({
  mockSafeFetchHtml: vi.fn(),
  mockToolUsageCreate: vi.fn(),
}))

vi.mock('@/lib/audit/url', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/url')>()
  return {
    ...actual,
    safeFetchHtml: mockSafeFetchHtml,
  }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    toolUsage: { create: mockToolUsageCreate },
  },
}))

import { AuditUrlError } from '@/lib/audit/url'
import { checkMetaPreview } from '@/lib/tools/meta-preview'
import { detectPlaceholders } from '@/lib/tools/placeholder-detector'

beforeEach(() => {
  vi.clearAllMocks()
  mockToolUsageCreate.mockResolvedValue({})
})

describe('public HTML tools', () => {
  it('use the bounded public HTML fetcher instead of unrestricted fetch', async () => {
    mockSafeFetchHtml.mockResolvedValue({
      html: '<html><head><title>Example</title></head><body>Lorem ipsum</body></html>',
      finalUrl: 'https://example.com/',
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
    })

    const [preview, placeholders] = await Promise.all([
      checkMetaPreview('example.com'),
      detectPlaceholders('example.com'),
    ])

    expect(mockSafeFetchHtml).toHaveBeenCalledTimes(2)
    expect(mockSafeFetchHtml).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ maxBytes: 2_000_000 })
    )
    expect(preview).toMatchObject({
      url: 'https://example.com/',
      title: 'Example',
      statusCode: 200,
      error: null,
    })
    expect(placeholders.totalFound).toBe(1)
  })

  it('surfaces public-network validation errors without fetching through a fallback', async () => {
    mockSafeFetchHtml.mockRejectedValue(
      new AuditUrlError('FixFlags can only check publicly accessible URLs')
    )

    const [preview, placeholders] = await Promise.all([
      checkMetaPreview('http://127.0.0.1'),
      detectPlaceholders('http://127.0.0.1'),
    ])

    expect(preview.error).toBe('FixFlags can only check publicly accessible URLs')
    expect(placeholders.error).toBe('FixFlags can only check publicly accessible URLs')
    expect(mockToolUsageCreate).not.toHaveBeenCalled()
  })
})
