import { describe, it, expect, afterEach } from 'vitest'
import { runAuthCheckoutChecks } from '../checks/auth-checkout'
import type { PageMetadata } from '../metadata'

function metaWithLinks(links: PageMetadata['links']): PageMetadata {
  return { links } as PageMetadata
}

let restore: (() => void) | undefined

function mockFetchHead(responses: Record<string, number>) {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    for (const [path, status] of Object.entries(responses)) {
      if (url.includes(path)) return new Response(null, { status })
    }
    return new Response(null, { status: 200 })
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

afterEach(() => {
  restore?.()
  restore = undefined
})

function ids(flags: Awaited<ReturnType<typeof runAuthCheckoutChecks>>): string[] {
  return flags.map((f) => f.checkId)
}

describe('runAuthCheckoutChecks', () => {
  it('flags a dead checkout link as a critical revenue issue', async () => {
    restore = mockFetchHead({ '/checkout': 404 })
    const flags = await runAuthCheckoutChecks(
      'https://example.com',
      metaWithLinks([{ href: 'https://example.com/checkout', text: 'Subscribe', rel: null }])
    )
    expect(ids(flags)).toContain('checkout-link-dead')
    expect(flags[0].severity).toBe('CRITICAL')
    expect(flags[0].impactTag).toBe('REVENUE')
  })

  it('flags a dead login link', async () => {
    restore = mockFetchHead({ '/login': 500 })
    const flags = await runAuthCheckoutChecks(
      'https://example.com',
      metaWithLinks([{ href: 'https://example.com/login', text: 'Log in', rel: null }])
    )
    expect(ids(flags)).toContain('auth-page-broken')
  })

  it('covers cross-origin Stripe payment links', async () => {
    restore = mockFetchHead({ 'buy.stripe.com': 404 })
    const flags = await runAuthCheckoutChecks(
      'https://example.com',
      metaWithLinks([{ href: 'https://buy.stripe.com/test_dead', text: 'Buy', rel: null }])
    )
    expect(ids(flags)).toContain('checkout-link-dead')
  })

  it('does not flag healthy auth/checkout links', async () => {
    restore = mockFetchHead({})
    const flags = await runAuthCheckoutChecks(
      'https://example.com',
      metaWithLinks([
        { href: 'https://example.com/login', text: 'Log in', rel: null },
        { href: 'https://example.com/checkout', text: 'Subscribe', rel: null },
      ])
    )
    expect(flags).toEqual([])
  })

  it('ignores unrelated links', async () => {
    restore = mockFetchHead({ '/blog': 404 })
    const flags = await runAuthCheckoutChecks(
      'https://example.com',
      metaWithLinks([{ href: 'https://example.com/blog', text: 'Blog', rel: null }])
    )
    expect(flags).toEqual([])
  })

  it('does not raise a false alarm when HEAD is blocked (network error)', async () => {
    restore = (() => {
      const original = globalThis.fetch
      globalThis.fetch = (async () => {
        throw new Error('ECONNRESET')
      }) as typeof fetch
      return () => {
        globalThis.fetch = original
      }
    })()
    const flags = await runAuthCheckoutChecks(
      'https://example.com',
      metaWithLinks([{ href: 'https://buy.stripe.com/x', text: 'Buy', rel: null }])
    )
    expect(flags).toEqual([])
  })
})
