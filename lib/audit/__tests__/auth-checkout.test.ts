import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(({ resolve4: vi.fn(async () => ['93.184.216.34']), resolve6: vi.fn(async () => []) })))
import { actionDestinationObservation, runAuthCheckoutChecks } from '../checks/auth-checkout'
import type { PageMetadata } from '../metadata'
import { destinationContext } from '../checks/destination-evidence'

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
  it('retains monitoring responsibility when new actions precede the original destination', async () => {
    const source = 'https://example.com/', original = source + 'checkout?plan=original'
    const links = Array.from({ length: 10 }, (_, index) => ({ href: source + 'checkout?plan=new-' + index, text: 'Subscribe', rel: null }))
    links.push({ href: original, text: 'Subscribe', rel: null })
    const openDestination = vi.fn(async (url: string) => ({ url, status: url === original ? 404 : 200,
      outcome: url === original ? 'not_found' as const : 'reachable' as const, shouldFlagDead: url === original }))
    const scope: { complete?: boolean } = {}
    const options = { openDestination, scope, retainedContexts: new Set([destinationContext(source, original)]) }
    expect(ids(await runAuthCheckoutChecks(source, metaWithLinks(links), options))).toContain('checkout-link-dead')
    expect(openDestination.mock.calls.map(([url]) => url)).toEqual([original, ...links.slice(0, 7).map(link => link.href)])
    expect(scope.complete).toBe(false)
    openDestination.mockClear()
    await runAuthCheckoutChecks(source, metaWithLinks(links.slice(0, 10)), options)
    expect(openDestination.mock.calls.map(([url]) => url)).not.toContain(original)
  })
  it('reserves targeted repair for original action destinations beyond new unrelated actions', async () => {
    const source = 'https://example.com/', original = source + 'checkout?plan=original'
    const links = Array.from({ length: 10 }, (_, index) => ({ href: source + 'checkout?plan=new-' + index, text: 'Subscribe', rel: null }))
    links.push({ href: original, text: 'Subscribe', rel: null })
    const openDestination = vi.fn(async (url: string) => ({ url, status: 200, outcome: 'reachable' as const, shouldFlagDead: false }))
    const scope: { complete?: boolean } = {}
    const options = { openDestination, scope, originalContexts: [destinationContext(source, original)] }
    expect(await runAuthCheckoutChecks(source, metaWithLinks(links), options)).toEqual([])
    expect(openDestination.mock.calls.map(([url]) => url)).toEqual([original])
    expect(scope.complete).toBe(true)
    openDestination.mockClear()
    await runAuthCheckoutChecks(source, metaWithLinks(links.slice(0, 10)), options)
    expect(openDestination).not.toHaveBeenCalled()
    expect(scope.complete).toBe(false)
  })
  it('keeps checkout recovery unknown at a sign-in response while retaining intended auth-entry evidence', () => {
    const source = 'https://example.com/', url = source + 'checkout'
    const result = { url, outcome: 'auth_required' as const, status: 200, shouldFlagDead: false }
    expect(actionDestinationObservation(source, url, 'checkout', result)).toMatchObject({ passed: false, complete: false })
    expect(actionDestinationObservation(source, source + 'login', 'auth', { ...result, url: source + 'login' }))
      .toMatchObject({ passed: true, complete: true })
  })
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

  it('checks actual action paths, labels and payment hosts without treating URL parameters as action links', async () => {
    const source = 'https://example.com/'
    const links = [
      { href: '/help?next=/checkout', text: 'Help' },
      { href: '/article?source=buy.stripe.com#login', text: 'Article' },
      { href: 'https://buy.stripe.com.example.com/help', text: 'Help' },
      { href: '/support#signup', text: 'Support' },
      { href: '/checkout?token=PRIVATE_VALUE', text: 'Plans' },
      { href: '/gateway?action=subscribe', text: 'Subscribe' },
      { href: 'https://www.paypal.com/pay?id=PRIVATE_VALUE', text: 'Pay' },
      { href: '/login?return=/checkout', text: 'Log in' },
    ].map(link => ({ ...link, rel: null }))
    const openDestination = vi.fn(async (url: string) => ({ url, status: 404, outcome: 'not_found' as const, shouldFlagDead: true }))
    const findings = await runAuthCheckoutChecks(source, metaWithLinks(links), { openDestination })
    expect(openDestination.mock.calls.map(([url]) => url)).toEqual(links.slice(4).map(link => new URL(link.href, source).href))
    expect(findings).toMatchObject([
      { checkId: 'checkout-link-dead', evidenceTargets: expect.arrayContaining(links.slice(4, 7).map(link => expect.objectContaining({
        context: destinationContext(source, new URL(link.href, source).href),
      }))) },
      { checkId: 'auth-page-broken', evidenceTargets: [{ context: destinationContext(source, new URL(links[7].href, source).href) }] },
    ])
    expect(JSON.stringify(findings)).not.toContain('PRIVATE_VALUE')
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
