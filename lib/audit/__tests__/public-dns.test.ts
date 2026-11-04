import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn(), cancel: vi.fn() }))
vi.mock('node:dns/promises', async () => (await import('./dns-fixture')).dnsFixture(dns))
import { assertPublicNavigationUrl, resolvePublicAddresses } from '../url'
import { classifyPublicRequestFailure } from '../http-failure'

describe('owned public DNS lifetime', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  it('bounds URL-first admission without a caller-supplied deadline and cancels its pending queries', async () => {
    dns.resolve4.mockImplementation(() => new Promise(() => {}))
    dns.resolve6.mockImplementation(() => new Promise(() => {}))
    let failure: unknown
    const lookup = assertPublicNavigationUrl('https://stalled.example/').catch(error => { failure = error })
    await vi.advanceTimersByTimeAsync(5001)
    expect(failure).toMatchObject({ code: 'DNS_UNAVAILABLE' })
    expect(classifyPublicRequestFailure(failure).result).toBe('UNKNOWN')
    expect(dns.cancel).toHaveBeenCalledOnce()
    await lookup
  })
  it('cancels both pending families when the owning request stops', async () => {
    dns.resolve4.mockImplementation(() => new Promise(() => {}))
    dns.resolve6.mockImplementation(() => new Promise(() => {}))
    const controller = new AbortController(), reason = new Error('Owning request stopped')
    const lookup = resolvePublicAddresses('cancelled.example', controller.signal)
    const observed = lookup.catch(error => error)
    await vi.advanceTimersByTimeAsync(1)
    controller.abort(reason)
    expect(await observed).toBe(reason)
    expect(dns.cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps a completed public family from authorizing an unresolved family', async () => {
    dns.resolve4.mockResolvedValue(['93.184.216.34'])
    dns.resolve6.mockImplementation(() => new Promise(() => {}))
    let failure: unknown
    const lookup = resolvePublicAddresses('partial.example').catch(error => { failure = error })
    await vi.advanceTimersByTimeAsync(5001)
    expect(failure).toMatchObject({ code: 'DNS_UNAVAILABLE' })
    await lookup
  })
  it('refuses a known private answer without waiting for an unrelated stalled family', async () => {
    dns.resolve4.mockResolvedValue(['127.0.0.1'])
    dns.resolve6.mockImplementation(() => new Promise(() => {}))
    const lookup = resolvePublicAddresses('private.example').catch(error => error)
    await vi.advanceTimersByTimeAsync(1)
    expect(await lookup).toMatchObject({ code: 'UNSAFE_DESTINATION' })
    expect(dns.cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
