import { afterEach, describe, expect, it, vi } from 'vitest'
import { Resend } from 'resend'
import { sendNotificationEmail } from '../notification-delivery'

const message = { from: 'FixFlags <watch@example.test>', to: 'owner@example.test', subject: 'Site alert',
  html: '<p>Recorded observation</p>', text: 'Recorded observation', tags: [] }
const provider = () => new Resend('re_fixture_not_a_real_key')
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('bounded monitoring email transport', () => {
  it('aborts the installed SDK physical request at the deadline', async () => {
    vi.useFakeTimers()
    let physicalSignal: AbortSignal | undefined
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => {
      physicalSignal = options?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        physicalSignal!.addEventListener('abort', () => reject(physicalSignal!.reason), { once: true })
      })
    })
    const result = expect(sendNotificationEmail(provider(), message, 'recorded-delivery')).rejects.toThrow()
    expect(physicalSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(20_000)
    await result
    expect(physicalSignal?.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('recorded-delivery')
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    [200, {}, 'Email provider did not confirm acceptance'],
    [429, { name: 'rate_limit_exceeded', message: 'Try again later' }, 'Try again later'],
  ])('keeps an unconfirmed HTTP %s response as failed delivery', async (status, response, error) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), {
      status, headers: { 'content-type': 'application/json' },
    }))
    await expect(sendNotificationEmail(provider(), message, 'recorded-delivery')).rejects.toThrow(error)
  })

  it('returns only confirmed provider acceptance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'accepted-id' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    expect(await sendNotificationEmail(provider(), message, 'recorded-delivery')).toBe('accepted-id')
  })
})
