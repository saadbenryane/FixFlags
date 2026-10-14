import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readGithubConnectState, signGithubConnectState, revokeGithubGrant } from '../github'
import { githubSettingsDestination, githubSiteDestination, githubResultDestination } from '../github-continuation'

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
  vi.stubEnv('BETTER_AUTH_SECRET', 'isolated-state-test-secret')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('GitHub account continuation', () => {
  it('retains an exact Site integration destination in signed state', () => {
    const destination = githubSettingsDestination('/sites/site_123?view=integrations#integrations')
    const state = signGithubConnectState('owner', destination)
    expect(readGithubConnectState(state, 'owner')).toEqual({ destination })
    expect(githubResultDestination(destination, 'connected', '1')).toContain('next=%2Fsites%2Fsite_123')
  })
  it('rejects another owner, tampering, appended fields and malformed state', () => {
    const state = signGithubConnectState('owner')
    expect(readGithubConnectState(state, 'foreign')).toBeNull()
    expect(readGithubConnectState(state + '.extra', 'owner')).toBeNull()
    expect(readGithubConnectState(state.replace(/.$/, 'z'), 'owner')).toBeNull()
    expect(readGithubConnectState('v2.evil.deadbeef', 'owner')).toBeNull()
  })
  it('rejects expired and future handshakes', () => {
    const state = signGithubConnectState('owner')
    vi.advanceTimersByTime(600_001)
    expect(readGithubConnectState(state, 'owner')).toBeNull()
    vi.setSystemTime(new Date('2026-10-14T09:59:59Z'))
    expect(readGithubConnectState(state, 'owner')).toBeNull()
  })
  it('supports only the original time-limited legacy state shape', () => {
    const payload = `owner.${Date.now()}`
    const signature = createHmac('sha256', 'isolated-state-test-secret').update(payload).digest('hex')
    const state = Buffer.from(`${payload}.${signature}`).toString('base64url')
    expect(readGithubConnectState(state, 'owner')).toEqual({ destination: '/settings/integrations' })
    expect(readGithubConnectState(Buffer.from(`${payload}.${signature}.extra`).toString('base64url'), 'owner')).toBeNull()
  })
  it.each(['https://evil.example/sites/a?view=integrations', '//evil.example/sites/a?view=integrations', '/sites/a?view=integrations&redirect=https://evil.example', '/sites/a/flags/private?view=integrations', '/sites/a?view=integrations#other', '/sites/a?view=overview', '/settings'])('rejects unsafe return destination %s', value => {
    expect(githubSiteDestination(value)).toBeNull()
    expect(githubSettingsDestination(value)).toBe('/settings/integrations')
  })
  it('reports missing configuration and failed revocation as unconfirmed', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', ''); vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect(await revokeGithubGrant('private-token')).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
    vi.stubEnv('GITHUB_CLIENT_ID', 'test-client'); vi.stubEnv('GITHUB_CLIENT_SECRET', 'test-secret')
    fetcher.mockResolvedValue(new Response(null, { status: 404 }))
    expect(await revokeGithubGrant('private-token')).toBe(false)
    fetcher.mockResolvedValue(new Response(null, { status: 204 }))
    expect(await revokeGithubGrant('private-token')).toBe(true)
  })
})
