import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, afterEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    audit: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { loadAuditScreenshotBase64 } from '../load-screenshot-base64'

const fetchMock = vi.fn()

describe('loadAuditScreenshotBase64', () => {
  beforeEach(() => {
    prismaMock.audit.findUnique.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns nulls when the audit does not exist', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(null)
    const result = await loadAuditScreenshotBase64('audit-1')
    assert.deepEqual(result, { desktopBase64: null, mobileBase64: null })
  })

  it('fetches and base64-encodes desktop and mobile screenshots', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      screenshots: [
        { device: 'DESKTOP', url: 'https://cdn.example/desktop.png' },
        { device: 'MOBILE', url: 'https://cdn.example/mobile.png' },
      ],
    })
    fetchMock.mockImplementation(async (url: string) => {
      const body = url.includes('desktop') ? 'desktop-bytes' : 'mobile-bytes'
      return new Response(body, { status: 200 })
    })

    const result = await loadAuditScreenshotBase64('audit-1')
    assert.equal(result.desktopBase64, Buffer.from('desktop-bytes').toString('base64'))
    assert.equal(result.mobileBase64, Buffer.from('mobile-bytes').toString('base64'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null for missing devices and failed fetches', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      screenshots: [{ device: 'DESKTOP', url: 'https://cdn.example/desktop.png' }],
    })
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }))

    const result = await loadAuditScreenshotBase64('audit-1')
    assert.equal(result.desktopBase64, null)
    assert.equal(result.mobileBase64, null)
  })

  it('swallows fetch exceptions', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      screenshots: [{ device: 'DESKTOP', url: 'https://cdn.example/desktop.png' }],
    })
    fetchMock.mockRejectedValue(new Error('network down'))

    const result = await loadAuditScreenshotBase64('audit-1')
    assert.equal(result.desktopBase64, null)
  })
})

import { expect } from 'vitest'
void expect
