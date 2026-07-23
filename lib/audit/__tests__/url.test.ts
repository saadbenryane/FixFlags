import { describe, expect, it } from 'vitest'
import { normalizeAuditUrl } from '@/lib/audit/url'

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
})
