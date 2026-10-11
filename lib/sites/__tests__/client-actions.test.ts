import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSiteAction, readSiteActionResponse } from '../client-actions'
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
})
