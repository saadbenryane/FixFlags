import { describe, expect, it } from 'vitest'
import { normalizeAuditUrl, normalizeAuditNavigationUrl } from '@/lib/audit/url'

describe('audit URL boundary', () => {
  it.each([
    'http://localhost',
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://192.168.1.10',
    'http://[::1]',
    'http://metadata.google.internal',
  ])('rejects private or metadata destinations: %s', (url) => {
    expect(normalizeAuditUrl(url)).toEqual({
      ok: false,
      error: 'FixFlags can only check publicly accessible URLs',
    })
  })

  it('accepts public HTTP URLs and removes fragments', () => {
    expect(normalizeAuditUrl('https://example.com/path#section')).toEqual({
      ok: true,
      url: 'https://example.com/path',
    })
  })

  it('keeps server admission explicit while preserving a supplied public port and navigation state', () => {
    expect(normalizeAuditNavigationUrl('example.com:8443/path')).toMatchObject({ ok: false })
    expect(normalizeAuditNavigationUrl('//example.com/path')).toMatchObject({ ok: false })
    expect(normalizeAuditNavigationUrl('https://example.com:8443/plans/?return=/account/#/pricing/')).toEqual({
      ok: true, url: 'https://example.com:8443/plans/?return=/account/#/pricing/',
    })
    expect(normalizeAuditUrl('https://example.com:8443/plans/?return=/account/#/pricing/')).toEqual({
      ok: true, url: 'https://example.com:8443/plans/?return=/account/',
    })
  })

  it('keeps credential and scheme refusals at the server boundary', () => {
    expect(normalizeAuditNavigationUrl('https://owner:secret@example.com/')).toEqual({ ok: false, error: 'URLs containing credentials cannot be checked' })
    expect(normalizeAuditNavigationUrl('javascript:123')).toEqual({ ok: false, error: 'Only public HTTP and HTTPS URLs can be checked' })
    expect(normalizeAuditNavigationUrl(undefined as unknown as string)).toEqual({ ok: false, error: 'Invalid URL format' })
  })
})
