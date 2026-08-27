import { describe, expect, it } from 'vitest'
import {
  deadDestinationFlags,
  detectSoft404,
  openCheckDestination,
  openCheckDestinations,
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

  it('deduplicates destinations before fetching', async () => {
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
    expect(results).toHaveLength(1)
    expect(gets).toBeGreaterThan(0)
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
