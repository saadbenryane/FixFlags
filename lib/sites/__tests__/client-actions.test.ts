import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSiteAction, readSiteActionResponse, createSiteActionController } from '../client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

afterEach(() => vi.unstubAllGlobals())
describe('Site action responses', () => {
  it('keeps actionable API errors and rejects malformed success payloads', async () => {
    expect(await readSiteActionResponse(Response.json({ message: 'Confirm coverage first' }, { status: 409 }))).toMatchObject({ error: 'Confirm coverage first' })
    await expect(readSiteActionResponse(Response.json({ interval: 'fortnightly' }))).rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
    await expect(readSiteActionResponse(Response.json({ authorizeUrl: 'javascript:alert(1)' }))).rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
  })
  it('exposes session expiration and network failure without reporting success', async () => {
    await expect(readSiteActionResponse(Response.json({}, { status: 401 }))).rejects.toMatchObject({ status: 401 })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(fetchSiteAction('/api/sites/site/settings')).rejects.toThrow(SITE_ACTION_COPY.interrupted)
  })
  it('requires operation-specific success fields, not an empty envelope', async () => {
    for (const operation of ['settings', 'outcome', 'watch', 'authorize', 'run', 'outcomeEnabled', 'fixPrompt'] as const)
      await expect(readSiteActionResponse(Response.json({ ok: true }), operation)).rejects.toThrow(SITE_ACTION_COPY.invalidResponse)
    await expect(readSiteActionResponse(Response.json({ ok: true, notificationLevel: 'FLAGS', notifyOnRecovery: true }), 'settings'))
      .resolves.toMatchObject({ ok: true, notificationLevel: 'FLAGS' })
    for (const setting of [{ accountChecksEnabled: false }, { notifyOnRecovery: false }])
      await expect(readSiteActionResponse(Response.json({ ok: true, ...setting }), 'settings')).resolves.toMatchObject(setting)
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
})
