import { describe, expect, it, vi } from 'vitest'
import type { Route } from 'playwright'
import { applyJourneyRouteGuards } from '../journey-safety'

function request(url: string, method: string, type = 'fetch') {
  const route = { request: () => ({ url: () => url, method: () => method, resourceType: () => type }),
    abort: vi.fn(async () => {}), fetch: vi.fn(async () => ({ status: () => 200 })), fulfill: vi.fn(async () => {}) }
  return route
}
describe('public journeys do not create external effects', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks %s engagement before transmission, including beacons', async method => {
    const route = request('https://example.com/api/signup', method, 'other'), next = vi.fn(async () => {}), refused = vi.fn()
    const probe = { result: null, probed: false }
    await applyJourneyRouteGuards(route as unknown as Route, next, { origin: 'https://example.com', formProbe: probe, onRefusal: refused })
    expect(route.abort).toHaveBeenCalledWith('blockedbyclient')
    expect(route.fetch).not.toHaveBeenCalled(); expect(route.fulfill).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled()
    expect(probe.result).toBeNull(); expect(refused).toHaveBeenCalledWith('protected_action_requires_fixture')
  })
  it.each(['http://example.com/cart/add', 'https://example.com:8443/cart/add', 'https://other.example/cart/add'])('does not authorize a cart write to %s', async url => {
    const route = request(url, 'POST'), next = vi.fn(async () => {})
    await applyJourneyRouteGuards(route as unknown as Route, next, { origin: 'https://example.com', originHost: 'example.com', allowCartMutations: true })
    expect(route.abort).toHaveBeenCalled(); expect(next).not.toHaveBeenCalled()
  })
  it.each(['/payments', '/wallets', '/checkout', '/checkouts/cn/order'])('does not turn cart permission into submission authority at %s', async pathname => {
    const route = request('https://example.com' + pathname, 'POST'), next = vi.fn(async () => {})
    await applyJourneyRouteGuards(route as unknown as Route, next, { origin: 'https://example.com', allowCartMutations: true })
    expect(route.abort).toHaveBeenCalled(); expect(route.fetch).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled()
  })
  it('retains the explicitly supported exact-origin cart entry, without payment execution', async () => {
    const cart = request('https://example.com/cart/add.js', 'POST'), next = vi.fn(async () => {})
    await applyJourneyRouteGuards(cart as unknown as Route, next, { origin: 'https://example.com', allowCartMutations: true })
    expect(next).toHaveBeenCalledTimes(1)
    const payment = request('https://checkout.stripe.com/pay', 'POST')
    await applyJourneyRouteGuards(payment as unknown as Route, next, { origin: 'https://example.com', allowCartMutations: true })
    expect(payment.abort).toHaveBeenCalled(); expect(payment.fetch).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledTimes(1)
  })
})
