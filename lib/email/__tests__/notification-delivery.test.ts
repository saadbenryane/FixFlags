import { afterEach, describe, expect, it, vi } from 'vitest'
import { Resend } from 'resend'
import { assertNotificationReplayWindow, notificationEmailBody, notificationRetryAt, prepareNotificationReplay, sendNotificationEmail } from '../notification-delivery'

const message = { from: 'FixFlags <watch@example.test>', to: 'owner@example.test', subject: 'Site alert',
  html: '<p>Recorded observation</p>', text: 'Recorded observation', tags: [] }
const provider = () => new Resend('re_fixture_not_a_real_key')
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('monitoring delivery replay window', () => {
  const started = new Date('2026-10-20T12:00:00Z')
  const snapshot = { version: 1 as const, ...message }
  it('retains the first attempt across retries and excludes it from the provider body', () => {
    const first = prepareNotificationReplay(snapshot, started, started)
    const retry = prepareNotificationReplay(first, new Date(started.getTime() + 3600_000), new Date())
    expect(retry.firstAttemptAt).toBe(started.toISOString())
    expect(notificationEmailBody(retry)).toEqual(message)
  })
  it('uses the original event as a conservative bound for a legacy snapshot', () => {
    expect(prepareNotificationReplay(snapshot, new Date(started.getTime() + 3600_000), started).firstAttemptAt).toBe(started.toISOString())
    expect(() => prepareNotificationReplay(snapshot, new Date(started.getTime() + 25 * 3600_000), started)).toThrow('idempotency window')
  })
  it('requires the complete physical request to fit within provider retention', () => {
    const lastSafe = new Date(started.getTime() + 24 * 3600_000 - 20_001)
    expect(() => assertNotificationReplayWindow(started.toISOString(), lastSafe)).not.toThrow()
    expect(() => assertNotificationReplayWindow(started.toISOString(), new Date(lastSafe.getTime() + 1))).toThrow('idempotency window')
  })
  it.each([undefined, 'invalid', '2026-10-21T12:00:00Z'])(
    'refuses an unknown or future submission time: %s', time => {
      expect(() => assertNotificationReplayWindow(time, started)).toThrow('acceptance is unconfirmed')
    })
})

it.each([[1, 5], [2, 10], [3, 20], [20, 360]])('backs off failed attempt %s by %s minutes', (attempt, minutes) => {
  const failedAt = new Date('2026-10-20T12:00:00Z')
  expect(notificationRetryAt(attempt, failedAt).getTime() - failedAt.getTime()).toBe(minutes * 60_000)
})

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
