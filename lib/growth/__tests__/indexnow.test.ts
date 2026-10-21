import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexNowPayload, notifyIndexNow, validIndexNowKey } from '../indexnow'
import { GET } from '@/app/indexnow-key.txt/route'

const key = 'synthetic-indexnow-key-123456'
const input = { paths: ['/guides'], allowedPaths: ['/guides'], key }
const content = '<title>Guide</title><link rel="canonical" href="https://fixflags.com/guides"><h1>Guide</h1>'
const page = (body = content, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html' } })

afterEach(() => vi.unstubAllEnvs())

describe('IndexNow public content notifications', () => {
  it('keeps missing or malformed keys absent from the public route', async () => {
    for (const value of ['', 'secret\nheader', 'short']) {
      vi.stubEnv('INDEXNOW_KEY', value)
      expect(GET().status).toBe(404)
      expect(validIndexNowKey(value)).toBe(false)
    }
    vi.stubEnv('INDEXNOW_KEY', key)
    const response = GET()
    expect(await response.text()).toBe(key)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('refuses customer, unregistered and parameterized paths before any request', () => {
    for (const path of ['/sites/private', '//foreign.test/', '/guides?email=private', '/guides#section']) {
      expect(() => indexNowPayload([path], ['/guides'], key)).toThrow()
    }
    expect(indexNowPayload(['/guides', '/guides'], ['/guides'], key).urlList).toEqual(['https://fixflags.com/guides'])
  })

  it('checks deployed key and canonical content before notifying the fixed endpoint', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(key)).mockResolvedValueOnce(page()).mockResolvedValueOnce(new Response(null, { status: 202 }))
    const result = await notifyIndexNow({ ...input, fetch: request })
    expect(result).toEqual({ status: 'key-validation-pending', providerStatus: 202, notifiedUrls: 1, indexingVerified: false })
    expect(request.mock.calls[2][0]).toBe('https://api.indexnow.org/indexnow')
    expect(JSON.parse(request.mock.calls[2][1].body)).toMatchObject({ keyLocation: 'https://fixflags.com/indexnow-key.txt' })
    expect(JSON.stringify(result)).not.toContain(key)
  })

  it('does not notify when key, content, metadata or indexing directives fail', async () => {
    const missingKey = vi.fn().mockResolvedValue(new Response('different'))
    expect((await notifyIndexNow({ ...input, fetch: missingKey })).status).toBe('key-not-live')
    expect(missingKey).toHaveBeenCalledTimes(1)
    for (const result of [page(content, 404), page(content + '<meta name="robots" content="noindex">'), page(content.replace('https://fixflags.com/guides', 'https://other.test'))]) {
      const request = vi.fn().mockResolvedValueOnce(new Response(key)).mockResolvedValueOnce(result)
      expect((await notifyIndexNow({ ...input, fetch: request })).notifiedUrls).toBe(0)
      expect(request).toHaveBeenCalledTimes(2)
    }
  })

  it.each([[200, 'notification-accepted'], [429, 'notification-rejected']])('keeps provider response %s distinct from indexing', async (status, expected) => {
    const request = vi.fn().mockResolvedValueOnce(new Response(key)).mockResolvedValueOnce(page()).mockResolvedValueOnce(new Response(null, { status }))
    const result = await notifyIndexNow({ ...input, fetch: request })
    expect(result.status).toBe(expected)
    expect(result.indexingVerified).toBe(false)
  })
})
