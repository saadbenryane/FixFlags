import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ claim: vi.fn() }))
vi.mock('@/lib/queue/lock', () => ({ tryAcquireLock: fixture.claim }))
import { waitForEmailProviderCapacity } from '../provider-admission'

beforeEach(() => { vi.useFakeTimers(); fixture.claim.mockReset() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('bounded provider capacity admission', () => {
  it('uses one account-wide key and releases no permit that a later request could borrow', async () => {
    fixture.claim.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const result = waitForEmailProviderCapacity()
    await vi.advanceTimersByTimeAsync(125)
    await result
    expect(fixture.claim.mock.calls).toEqual([['resend-api', 125], ['resend-api', 125]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds a saturated or unavailable capacity service', async () => {
    fixture.claim.mockResolvedValue(false)
    const result = expect(waitForEmailProviderCapacity()).rejects.toThrow('capacity is temporarily unavailable')
    await vi.advanceTimersByTimeAsync(5000)
    await result
    const calls = fixture.claim.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(fixture.claim).toHaveBeenCalledTimes(calls)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects an unanswered command at the deadline and never admits its late success', async () => {
    let resolve!: (acquired: boolean) => void
    fixture.claim.mockImplementation(() => new Promise<boolean>(done => { resolve = done }))
    const result = expect(waitForEmailProviderCapacity()).rejects.toThrow('capacity is temporarily unavailable')
    await vi.advanceTimersByTimeAsync(5000)
    await result
    resolve(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fixture.claim).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors cancellation before admission and during a pending command', async () => {
    const stopped = AbortSignal.abort(new Error('Cancelled before admission'))
    await expect(waitForEmailProviderCapacity(stopped)).rejects.toThrow('Cancelled before admission')
    expect(fixture.claim).not.toHaveBeenCalled()
    fixture.claim.mockImplementation(() => new Promise(() => {}))
    const controller = new AbortController()
    const result = expect(waitForEmailProviderCapacity(controller.signal)).rejects.toThrow('Delivery deadline')
    controller.abort(new Error('Delivery deadline'))
    await result
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the SDK request and its cancellation signal after admission', async () => {
    fixture.claim.mockResolvedValue(true)
    vi.stubEnv('RESEND_API_KEY', 're_fixture_not_a_real_key')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'confirmed' })))
    vi.stubGlobal('fetch', fetch)
    vi.resetModules()
    const { resend } = await import('../client')
    const controller = new AbortController()
    const options = { idempotencyKey: 'same-delivery', signal: controller.signal }
    const message = { from: 'sender@example.test', to: 'owner@example.test', subject: 'Alert', html: '<p>Evidence</p>' }
    expect(await resend!.emails.send(message, options)).toEqual({
      data: { id: 'confirmed' }, error: null, headers: { 'content-type': 'text/plain;charset=UTF-8' },
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(message)
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Idempotency-Key')).toBe('same-delivery')
  })

  it('never contacts the provider after the caller cancels during admission', async () => {
    let resolve!: (acquired: boolean) => void
    fixture.claim.mockImplementation(() => new Promise<boolean>(done => { resolve = done }))
    vi.stubEnv('RESEND_API_KEY', 're_fixture_not_a_real_key')
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    vi.resetModules()
    const { resend } = await import('../client')
    const controller = new AbortController()
    const options = { signal: controller.signal }
    const result = expect(resend!.emails.send({ from: 'sender@example.test', to: 'owner@example.test', subject: 'Alert', html: '<p>Evidence</p>' },
      options)).rejects.toThrow('Delivery deadline')
    controller.abort(new Error('Delivery deadline'))
    await result
    resolve(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).not.toHaveBeenCalled()
  })
})
