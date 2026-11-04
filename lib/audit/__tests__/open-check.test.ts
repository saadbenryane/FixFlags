import { describe, expect, it } from 'vitest'
import {
  deadDestinationFlags,
  detectSoft404,
  openCheckDestination,
  openCheckDestinations,
  planOpenCheckDestinations,
  type OpenCheckFetch,
} from '@/lib/audit/open-check'

function jsonResponse(status: number, body = '', headers: Record<string, string> = {}, url = 'https://example.com/x') {
  return {
    status,
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null,
    },
    text: async () => body,
  } as unknown as Response
}

describe('open-check', () => {
  it('freezes the same exact destination inventory that the shared collector executes', async () => {
    const urls = ['https://example.com/en/details?plan=one', 'https://example.com/en/details?plan=one',
      'https://example.com/details?plan=two', 'https://other.example/details', 'https://example.com/tail']
    const planned = planOpenCheckDestinations(urls, { origin: 'https://example.com/', ceiling: 2 })
    expect(planned).toEqual({ urls: [urls[0], urls[2]], truncated: true })
    const fetched: string[] = []
    const observed = await openCheckDestinations(urls, { origin: 'https://example.com/', ceiling: 2,
      fetchImpl: async url => { fetched.push(String(url)); return jsonResponse(200, '<h1>Useful details</h1>', {}, String(url)) } })
    expect(fetched).toEqual(planned.urls)
    expect(observed.results.map(result => result.url)).toEqual(planned.urls)
    expect(observed.truncated).toBe(true)
  })
  it('uses GET evidence even when HEAD claims success', async () => {
    const fetchImpl: OpenCheckFetch = async (_url, init) => jsonResponse(init?.method === 'HEAD' ? 200 : 404,
      '<title>Page not found</title>', { 'content-type': 'text/html' }, 'https://example.com/gone')
    const result = await openCheckDestination('https://example.com/gone', { fetchImpl })
    expect(result.outcome).toBe('not_found')
    expect(result.shouldFlagDead).toBe(true)
  })

  it('flags a missing login page rather than treating its path as authorization evidence', async () => {
    const result = await openCheckDestination('https://example.com/login', {
      fetchImpl: async () => jsonResponse(404, '', {}, 'https://example.com/login'),
    })
    expect(result.shouldFlagDead).toBe(true)
  })
  it('does not Flag a destination as dead because HEAD failed', async () => {
    const fetchImpl: OpenCheckFetch = async (_url, init) => {
      if (init?.method === 'HEAD') throw new Error('HEAD blocked')
      return jsonResponse(200, '<html><title>Pricing</title></html>', { 'content-type': 'text/html' }, 'https://example.com/pricing')
    }
    const result = await openCheckDestination('https://example.com/pricing', { fetchImpl })
    expect(result.outcome).toBe('reachable')
    expect(result.shouldFlagDead).toBe(false)
  })

  it('Flags a GET 404 as a dead destination', async () => {
    const fetchImpl: OpenCheckFetch = async (_url, init) => {
      if (init?.method === 'HEAD') return jsonResponse(404)
      return jsonResponse(404, 'missing', { 'content-type': 'text/html' }, 'https://example.com/gone')
    }
    const result = await openCheckDestination('https://example.com/gone', { fetchImpl })
    expect(result.outcome).toBe('not_found')
    expect(result.shouldFlagDead).toBe(true)
  })

  it('treats a successful redirect as not dead', async () => {
    const fetchImpl: OpenCheckFetch = async () =>
      jsonResponse(200, '<html><title>Home</title></html>', { 'content-type': 'text/html' }, 'https://example.com/')
    const result = await openCheckDestination('https://example.com/old', { fetchImpl })
    expect(result.outcome).toBe('redirected')
    expect(result.shouldFlagDead).toBe(false)
  })

  it('does not Flag an auth page that loads without credentials', async () => {
    const fetchImpl: OpenCheckFetch = async () =>
      jsonResponse(
        200,
        '<html><title>Sign in</title></html>',
        { 'content-type': 'text/html' },
        'https://example.com/login'
      )
    const result = await openCheckDestination('https://example.com/login', { fetchImpl })
    expect(result.outcome).toBe('auth_required')
    expect(result.shouldFlagDead).toBe(false)
  })
  it.each(['https://example.com/login?next=%2Fdetails', 'https://example.com/account/login#continue', 'https://example.com/sign-in/?next=/details'])(
    'recognizes the actual sign-in path independently of query and fragment: %s', async finalUrl => {
      const result = await openCheckDestination('https://example.com/details', {
        fetchImpl: async () => jsonResponse(200, '<h1>Sign in to continue</h1>', { 'content-type': 'text/html' }, finalUrl),
      })
      expect(result).toMatchObject({ outcome: 'auth_required', status: 200, shouldFlagDead: false })
    })
  it('does not interpret an authentication path inside a query as the destination path', async () => {
    const finalUrl = 'https://example.com/details?example=/login'
    const result = await openCheckDestination(finalUrl, {
      fetchImpl: async () => jsonResponse(200, '<h1>Useful details</h1>', { 'content-type': 'text/html' }, finalUrl),
    })
    expect(result).toMatchObject({ outcome: 'reachable', status: 200, shouldFlagDead: false })
  })

  it('Flags a 200 soft-404', async () => {
    const html = '<html><title>Page not found</title><h1>Page not found</h1></html>'
    expect(detectSoft404(html, 200)).toBe(true)
    const fetchImpl: OpenCheckFetch = async (_url, init) => {
      if (init?.method === 'HEAD') return jsonResponse(405)
      return jsonResponse(200, html, { 'content-type': 'text/html' }, 'https://example.com/missing')
    }
    const result = await openCheckDestination('https://example.com/missing', { fetchImpl })
    expect(result.outcome).toBe('render_error')
    expect(result.shouldFlagDead).toBe(true)
  })

  it.each([
    '<script>window.fallback = "<h1>Page not found</h1>"</script>',
    '<script type="application/json">{"error":"404"}</script>',
    '<template><h1>Page not found</h1></template>',
    '<noscript><h1>Page not found</h1></noscript>',
    '<svg><title>404 fallback symbol</title></svg>',
    '<style>.error::after { content: "404" }</style>',
  ])('keeps dormant or non-content missing-page wording out of GET conclusions: %s', async dormant => {
    const html = '<!doctype html><html><head><title>Useful service</title></head><body>' + dormant +
      '<main><h1>Useful service</h1><p>Choose a service for your team.</p></main></body></html>'
    expect(detectSoft404(html, 200)).toBe(false)
    const result = await openCheckDestination('https://example.com/service', {
      fetchImpl: async () => jsonResponse(200, html, { 'content-type': 'text/html' }, 'https://example.com/service'),
    })
    expect(result).toMatchObject({ outcome: 'reachable', shouldFlagDead: false })
    expect(deadDestinationFlags([result], 'https://example.com/')).toEqual([])
  })

  it.each(['<h1>Page not found</h1>', '<h1>404</h1>', '<h1>Useful service</h1><p>We couldn&#39;t find this page.</p>'])(
    'retains missing-page evidence in the active document: %s', missing => {
      const html = '<!doctype html><html><head><title>Useful service</title></head><body><main>' + missing + '</main></body></html>'
      expect(detectSoft404(html, 200)).toBe(true)
    })

  it('does not Flag a timeout as a dead link', async () => {
    const fetchImpl: OpenCheckFetch = async () => {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
    const result = await openCheckDestination('https://example.com/slow', { fetchImpl })
    expect(result.outcome).toBe('timeout')
    expect(result.shouldFlagDead).toBe(false)
  })

  it('keeps physically different destinations even when review inventory considers them equivalent', async () => {
    let gets = 0
    const fetchImpl: OpenCheckFetch = async (_url, init) => {
      if (init?.method === 'GET' || init?.method === 'HEAD') {
        if (init.method === 'HEAD') gets += 0.5
        else gets += 1
      }
      return jsonResponse(200, '<html><title>Ok</title></html>', { 'content-type': 'text/html' })
    }
    const { results } = await openCheckDestinations(
      ['https://example.com/a', 'https://example.com/a/', 'https://example.com/a?utm_source=x'],
      { origin: 'https://example.com/', fetchImpl }
    )
    expect(results).toHaveLength(3)
    expect(gets).toBe(3)
  })

  it('fetches the supplied destination rather than its normalized inventory identity', async () => {
    const url = 'https://www.example.com/en/pricing/?lang=en&page=2'
    const requested: string[] = []
    const result = await openCheckDestinations([url], { origin: 'https://www.example.com/',
      fetchImpl: async input => { requested.push(input); return jsonResponse(200, '<title>Pricing</title>', {}, input) } })
    expect(requested).toEqual([url])
    expect(result.results[0].url).toBe(url)
  })

  it('emits a dead-destination Flag only when evidence is enough', () => {
    const flags = deadDestinationFlags(
      [
        {
          url: 'https://example.com/gone',
          canonicalUrl: 'https://example.com/gone',
          outcome: 'not_found',
          status: 404,
          finalUrl: 'https://example.com/gone',
          evidence: 'GET returned 404',
          shouldFlagDead: true,
        },
        {
          url: 'https://example.com/login',
          canonicalUrl: 'https://example.com/login',
          outcome: 'auth_required',
          status: 200,
          finalUrl: 'https://example.com/login',
          evidence: 'sign-in',
          shouldFlagDead: false,
        },
      ],
      'https://example.com/'
    )
    expect(flags).toHaveLength(1)
    expect(flags[0]?.problem).toMatch(/1 public link/)
  })
})
