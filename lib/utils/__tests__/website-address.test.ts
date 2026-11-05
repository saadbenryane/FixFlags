import { expect, it } from 'vitest'
import { parseWebsiteAddress } from '../website-address'

it.each([
  ['example.com', 'https://example.com'],
  ['  example.com:8443/pricing/?return=/account/#/plans/  ', 'https://example.com:8443/pricing/?return=/account/#/plans/'],
  ['//example.com:8443/#/checkout', 'https://example.com:8443/#/checkout'],
  ['8.8.8.8:8080/path', 'https://8.8.8.8:8080/path'],
  ['[2606:4700:4700::1111]:8443/path', 'https://[2606:4700:4700::1111]:8443/path'],
  ['https://example.com:8443/Plans/?return=/account/#/pricing/', 'https://example.com:8443/Plans/?return=/account/#/pricing/'],
  ['http://example.com/path', 'http://example.com/path'],
])('adds HTTPS only at website entry and preserves the supplied destination: %s', (input, expected) => {
  const result = parseWebsiteAddress(input, { inferHttps: true })
  expect(result).toMatchObject({ ok: true, url: expected })
  if (result.ok) expect(result.parsed.href).toBe(new URL(expected).href)
})

it.each([
  ['', 'empty'], ['not a url', 'malformed'], ['example.com:99999/path', 'malformed'],
  ['javascript:123', 'scheme'], ['mailto:owner@example.com', 'scheme'], ['data:text/html,hello', 'scheme'],
  ['ftp://example.com/file', 'scheme'], ['custom.protocol://example.com', 'scheme'],
  ['https://owner:secret@example.com/path', 'credentials'], ['//owner:secret@example.com', 'credentials'],
])('refuses invalid or credential-bearing website entry without rewriting it: %s', (input, reason) => {
  expect(parseWebsiteAddress(input, { inferHttps: true })).toEqual({ ok: false, reason })
})

it('requires an explicit scheme at non-entry boundaries', () => {
  for (const input of ['example.com', 'example.com:8443', '//example.com'])
    expect(parseWebsiteAddress(input).ok).toBe(false)
  expect(parseWebsiteAddress('https://example.com/path#state')).toMatchObject({ ok: true, url: 'https://example.com/path#state' })
})

it.each([undefined, null, 42, {}])('refuses non-string input at runtime: %j', input => {
  expect(parseWebsiteAddress(input as unknown as string)).toEqual({ ok: false, reason: 'malformed' })
})
