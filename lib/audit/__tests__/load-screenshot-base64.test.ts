import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, afterEach } from 'vitest'

const { prismaMock, readScreenshot } = vi.hoisted(() => ({
  readScreenshot: vi.fn(),
  prismaMock: {
    audit: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/storage/screenshots', () => ({ readScreenshot }))

import { loadAuditScreenshotBase64 } from '../load-screenshot-base64'

const fetchMock = vi.fn()

describe('loadAuditScreenshotBase64', () => {
  beforeEach(() => {
    prismaMock.audit.findUnique.mockReset()
    fetchMock.mockReset()
    readScreenshot.mockReset()
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

  it('reads private recorded desktop and mobile captures directly from storage', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      screenshots: [
        { device: 'DESKTOP', url: 'https://fixflags.test/api/screenshots/audit-1/desktop?page=p0-g2' },
        { device: 'MOBILE', url: 'https://fixflags.test/api/screenshots/audit-1/mobile?page=p0-g2' },
      ],
    })
    readScreenshot.mockImplementation(async (_audit: string, device: string) => Buffer.from(device + '-bytes'))

    const result = await loadAuditScreenshotBase64('audit-1')
    assert.equal(result.desktopBase64, Buffer.from('desktop-bytes').toString('base64'))
    assert.equal(result.mobileBase64, Buffer.from('mobile-bytes').toString('base64'))
    expect(readScreenshot).toHaveBeenCalledWith('audit-1', 'desktop', 'p0-g2')
    expect(readScreenshot).toHaveBeenCalledWith('audit-1', 'mobile', 'p0-g2')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null for missing devices and absent stored captures', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      screenshots: [{ device: 'DESKTOP', url: 'https://fixflags.test/api/screenshots/audit-1/desktop' }],
    })
    readScreenshot.mockResolvedValue(null)

    const result = await loadAuditScreenshotBase64('audit-1')
    assert.equal(result.desktopBase64, null)
    assert.equal(result.mobileBase64, null)
  })

  it('returns missing evidence when storage cannot be read', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      screenshots: [{ device: 'DESKTOP', url: 'https://fixflags.test/api/screenshots/audit-1/desktop' }],
    })
    readScreenshot.mockRejectedValue(new Error('storage down'))

    const result = await loadAuditScreenshotBase64('audit-1')
    assert.equal(result.desktopBase64, null)
  })

  it.each([
    'https://fixflags.test/api/screenshots/another-audit/desktop',
    'https://fixflags.test/api/screenshots/audit-1/mobile',
    'https://fixflags.test/api/screenshots/audit-1/desktop?page=..%2Fprivate',
    'https://other.test/unrelated.png',
  ])('refuses mismatched capture provenance without making an HTTP request: %s', async url => {
    prismaMock.audit.findUnique.mockResolvedValue({ screenshots: [{ device: 'DESKTOP', url }] })
    expect(await loadAuditScreenshotBase64('audit-1')).toEqual({ desktopBase64: null, mobileBase64: null })
    expect(readScreenshot).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

import { expect } from 'vitest'
void expect
