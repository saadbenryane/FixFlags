import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSiteActionJson, executeSiteAction, createSiteActionController, type SiteActionOperation } from '../client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
function perform(body: unknown, operation: SiteActionOperation = 'acknowledgement', status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))
  return executeSiteAction('/api/sites/site/settings', { method: 'POST' }, operation)
}
describe('Site action responses', () => {
  it('keeps actionable API errors and rejects malformed success payloads', async () => {
    await expect(perform({ message: 'Confirm coverage first', code: 'COVERAGE_REQUIRED' }, 'acknowledgement', 409)).rejects.toMatchObject({ message: 'Confirm coverage first', status: 409, code: 'COVERAGE_REQUIRED' })
    await expect(perform({ ok: true, interval: 'fortnightly' }, 'watch')).rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
    await expect(perform({ authorizeUrl: 'javascript:alert(1)' }, 'authorize')).rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
  })
  it('exposes session expiration and network failure without reporting success', async () => {
    await expect(perform({}, 'acknowledgement', 401)).rejects.toMatchObject({ status: 401 })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(fetchSiteActionJson('/api/sites/site/settings')).rejects.toThrow(SITE_ACTION_COPY.interrupted)
  })
  it('requires operation-specific success fields, not an empty envelope', async () => {
    for (const operation of ['settings', 'outcome', 'watch', 'authorize', 'run', 'outcomeEnabled', 'fixPrompt', 'fixPromptPreparation'] as const)
      await expect(perform({ ok: true }, operation)).rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
    await expect(perform({ ok: true, notificationLevel: 'FLAGS', notifyOnRecovery: true }, 'settings'))
      .resolves.toMatchObject({ ok: true, notificationLevel: 'FLAGS' })
    for (const setting of [{ accountChecksEnabled: false }, { notifyOnRecovery: false }])
      await expect(perform({ ok: true, ...setting }, 'settings')).resolves.toMatchObject(setting)
  })
  it.each([null, {}, { flagId: 'flag-1' }])('does not treat a missing copied-handoff receipt as success: %j', async handoff => {
    await expect(perform({ ok: true, prompt: 'A complete repair task.', handoff }, 'fixPrompt'))
      .rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
  })
  it('owns submission before React renders pending state', async () => {
    const controller = createSiteActionController()
    let finish!: (value: string) => void
    const mutation = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
    const first = controller.submit(mutation)
    expect(controller.pending).toBe(true)
    expect(await controller.submit(mutation)).toEqual({ kind: 'busy' })
    finish('saved')
    expect(await first).toEqual({ kind: 'saved', data: 'saved' })
    expect(mutation).toHaveBeenCalledTimes(1)
    expect(controller.pending).toBe(false)
  })
  it('does not misreport a completed mutation when authoritative refresh fails', async () => {
    const controller = createSiteActionController(), mutation = vi.fn(async () => ({ id: 'recorded-change' }))
    expect(await controller.submit(mutation, async () => { throw new Error('refresh interrupted') })).toEqual({
      kind: 'saved_refresh_pending', data: { id: 'recorded-change' },
    })
    expect(mutation).toHaveBeenCalledTimes(1)
  })
  it('publishes the validated command receipt before a slow refresh without releasing submission ownership', async () => {
    const controller = createSiteActionController(), committed = vi.fn()
    let complete!: () => void
    const refresh = new Promise<void>(resolve => { complete = resolve })
    const result = controller.submit(async () => ({ id: 'admitted' }), () => refresh, committed)
    await Promise.resolve(); await Promise.resolve()
    expect(committed).toHaveBeenCalledWith({ id: 'admitted' }); expect(controller.pending).toBe(true)
    complete(); expect((await result).kind).toBe('saved')
  })

  it.each(['headers', 'body'] as const)('bounds a stalled %s read, retains the retry key and ignores a late receipt', async phase => {
    vi.useFakeTimers()
    const controller = createSiteActionController(), committed = vi.fn()
    const key = controller.requestKey('same-command')
    let finishHeaders!: (value: Response) => void, finishBody!: (value: unknown) => void
    let signal!: AbortSignal
    const fetch = vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal!
      return new Promise<Response>(resolve => { finishHeaders = resolve })
    })
    vi.stubGlobal('fetch', fetch)
    const command = () => executeSiteAction('/api/sites/site/runs', {
      method: 'POST', headers: { 'Idempotency-Key': controller.requestKey('same-command') },
    }, 'acknowledgement')
    const result = controller.submit(command, undefined, committed)
    await vi.advanceTimersByTimeAsync(20_000)
    if (phase === 'body') {
      finishHeaders({ ok: true, status: 200, json: () => new Promise(resolve => { finishBody = resolve }) } as Response)
      await vi.advanceTimersByTimeAsync(0)
    }
    expect(controller.pending).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await result).toMatchObject({ kind: 'refused', error: { message: SITE_ACTION_COPY.interrupted } })
    expect(signal.aborted).toBe(true)
    expect(controller.pending).toBe(false)
    expect(committed).not.toHaveBeenCalled()
    expect(controller.requestKey('same-command')).toBe(key)
    fetch.mockResolvedValueOnce(Response.json({ ok: true }))
    expect(await controller.submit(command, undefined, committed)).toMatchObject({ kind: 'saved' })
    expect(fetch.mock.calls[1][1].headers).toEqual({ 'Idempotency-Key': key })
    if (phase === 'headers') finishHeaders(Response.json({ ok: true }))
    else finishBody({ ok: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(committed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves caller cancellation and never sends an already retired request', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    const fetch = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetch)
    const pending = fetchSiteActionJson('/api/sites/site/flags/flag', { signal: caller.signal })
    const result = expect(pending).rejects.toThrow(SITE_ACTION_COPY.interrupted)
    caller.abort()
    await result
    expect(vi.getTimerCount()).toBe(0)
    await expect(fetchSiteActionJson('/api/sites/site/flags/flag', { signal: caller.signal })).rejects.toThrow(SITE_ACTION_COPY.interrupted)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cleans up a successful request without aborting its completed transport on later caller disposal', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => { signal = options.signal; return Response.json({ ok: true }) }))
    await expect(executeSiteAction('/api/sites/site/settings', { signal: caller.signal }, 'acknowledgement')).resolves.toEqual({ ok: true })
    expect(vi.getTimerCount()).toBe(0)
    caller.abort()
    expect(signal.aborted).toBe(false)
  })

  it('allows the longer Agent reply window without leaving it unbounded', async () => {
    vi.useFakeTimers()
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(() => {}) }))
    const result = expect(executeSiteAction('/api/sites/site/agent', { method: 'POST' }, 'agentReply')).rejects.toThrow(SITE_ACTION_COPY.interrupted)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(90_000)
    await result
    expect(signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
