import { afterEach, describe, expect, it, vi } from 'vitest'
import { liveGoogleClient } from './google'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('bounded Analytics property discovery', () => {
  it('reads the retained property directly and follows its stream pages without enumerating accounts', async () => {
    const requests: URL[] = []
    vi.stubGlobal('fetch', vi.fn(async (target: string, options?: RequestInit) => {
      const url = new URL(target)
      requests.push(url)
      expect(url.origin).toBe('https://analyticsadmin.googleapis.com')
      expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-access')
      if (url.pathname === '/v1beta/properties/123') return Response.json({ displayName: 'Retained Site' })
      expect(url.pathname).toBe('/v1beta/properties/123/dataStreams')
      expect(url.searchParams.get('pageSize')).toBe('200')
      return url.searchParams.has('pageToken')
        ? Response.json({ dataStreams: [{ webStreamData: { defaultUri: 'https://www.example.com/' } }] })
        : Response.json({ dataStreams: [{ webStreamData: { defaultUri: 'https://other.example/' } }], nextPageToken: 'streams+/=' })
    }))
    await expect(liveGoogleClient().findAnalyticsProperty('fixture-access', 'example.com', 'properties/123'))
      .resolves.toMatchObject({ propertyId: 'properties/123', label: 'Retained Site', streamUrls: ['https://www.example.com/'] })
    expect(requests).toHaveLength(3)
    expect(requests[2].searchParams.get('pageToken')).toBe('streams+/=')
  })

  it('stops discovery at the first matching property without reading later unrelated streams', async () => {
    const transport = vi.fn(async (target: string) => new URL(target).pathname.endsWith('/accountSummaries')
      ? Response.json({ accountSummaries: [{ propertySummaries: [{ property: 'properties/1', displayName: 'Site' }, { property: 'properties/2' }] }], nextPageToken: 'unused' })
      : Response.json({ dataStreams: [{ webStreamData: { defaultUri: 'https://example.com/' } }], nextPageToken: 'unused' }))
    vi.stubGlobal('fetch', transport)
    expect(await liveGoogleClient().findAnalyticsProperty('fixture-access', 'example.com')).toMatchObject({ propertyId: 'properties/1' })
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('returns a mismatch only after completing the available catalog', async () => {
    const transport = vi.fn(async (target: string) => new URL(target).pathname.endsWith('/accountSummaries')
      ? Response.json({ accountSummaries: [{ propertySummaries: [{ property: 'properties/1' }, { property: 'properties/2' }] }] })
      : Response.json({ dataStreams: [{ webStreamData: { defaultUri: 'https://other.example/' } }] }))
    vi.stubGlobal('fetch', transport)
    expect(await liveGoogleClient().findAnalyticsProperty('fixture-access', 'example.com')).toBeNull()
    expect(transport).toHaveBeenCalledTimes(3)
  })

  it.each(['accounts', 'streams'] as const)('refuses repeated %s page tokens as incomplete discovery', async boundary => {
    const transport = vi.fn(async (target: string) => new URL(target).pathname.endsWith('/accountSummaries')
      ? Response.json({ accountSummaries: [{ propertySummaries: boundary === 'accounts' ? [] : [{ property: 'properties/1' }] }],
        ...(boundary === 'accounts' ? { nextPageToken: 'repeat' } : {}) })
      : Response.json({ dataStreams: [], nextPageToken: 'repeat' }))
    vi.stubGlobal('fetch', transport)
    await expect(liveGoogleClient().findAnalyticsProperty('fixture-access', 'example.com')).rejects.toThrow('pagination is incomplete')
    expect(transport).toHaveBeenCalledTimes(boundary === 'accounts' ? 2 : 3)
  })

  it('bounds an unfinished discovery without turning a partial catalog into a mismatch', async () => {
    let page = 0
    const transport = vi.fn(async () => Response.json({ accountSummaries: [], nextPageToken: 'next-' + ++page }))
    vi.stubGlobal('fetch', transport)
    await expect(liveGoogleClient().findAnalyticsProperty('fixture-access', 'example.com')).rejects.toThrow('request budget exceeded')
    expect(transport).toHaveBeenCalledTimes(100)
  })

  it('does not start discovery when its shared provider deadline has expired', async () => {
    const controller = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    const client = liveGoogleClient(), transport = vi.fn()
    vi.stubGlobal('fetch', transport)
    controller.abort(new Error('Controlled provider deadline'))
    await expect(client.findAnalyticsProperty('fixture-access', 'example.com')).rejects.toThrow('Controlled provider deadline')
    expect(transport).not.toHaveBeenCalled()
  })

  it('refuses a malformed retained property before constructing a provider request', async () => {
    const transport = vi.fn()
    vi.stubGlobal('fetch', transport)
    await expect(liveGoogleClient().findAnalyticsProperty('fixture-access', 'example.com', 'properties/123?other=456'))
      .rejects.toThrow('property identity is unavailable')
    expect(transport).not.toHaveBeenCalled()
  })
})
