import { describe, expect, it } from 'vitest'
import { googleResponseFailure, readGoogleTokens } from '../google-response'

describe('Google response meaning', () => {
  it.each([
    [400, 'invalid_grant', 'AUTH_EXPIRED'], [403, 'access_denied', 'PERMISSION_REFUSED'],
    [401, 'invalid_client', 'PROVIDER_UNAVAILABLE'], [400, 'invalid_request', 'PROVIDER_UNAVAILABLE'],
    [429, 'rate_limit_exceeded', 'PROVIDER_QUOTA'], [503, 'temporarily_unavailable', 'PROVIDER_UNAVAILABLE'],
    [503, 'invalid_grant', 'PROVIDER_UNAVAILABLE'],
  ] as const)('distinguishes OAuth %s %s from customer authorization loss', async (status, error, code) => {
    const failure = await googleResponseFailure(Response.json({ error, error_description: 'Private provider diagnostic' },
      { status, headers: { 'retry-after': '13' } }), true)
    expect(failure).toMatchObject({ code, retryAfterMs: 13_000 })
    expect(failure.requiresReauthentication).toBe(code === 'AUTH_EXPIRED' || code === 'PERMISSION_REFUSED')
    expect(failure.message).not.toContain('Private provider diagnostic')
  })
  it('retains resource quota semantics when Google responds with a permission-shaped status', async () => {
    expect(await googleResponseFailure(Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 })))
      .toMatchObject({ code: 'PROVIDER_QUOTA' })
    expect(await googleResponseFailure(Response.json({ error: { errors: 'invalid payload' } }, { status: 503 })))
      .toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })
  it.each([
    { access_token: 'token' }, { access_token: 'token', expires_in: '3600' },
    { access_token: 'token', expires_in: -1 }, { access_token: '', expires_in: 3600 },
    { access_token: 'token', expires_in: 3600, refresh_token: 4 },
  ])('refuses malformed OAuth credentials without inventing expiration: %j', async payload => {
    await expect(readGoogleTokens(Response.json(payload))).rejects.toMatchObject({ code: 'MALFORMED_PROVIDER_RESPONSE' })
  })
  it('bounds token-response bodies and retains a valid optional refresh credential', async () => {
    await expect(readGoogleTokens(Response.json({ access_token: 'token', expires_in: 3600, padding: 'x'.repeat(17_000) })))
      .rejects.toMatchObject({ code: 'MALFORMED_PROVIDER_RESPONSE' })
    expect(await readGoogleTokens(Response.json({ access_token: 'token', expires_in: 3600, refresh_token: 'refreshed' })))
      .toEqual({ access_token: 'token', expires_in: 3600, refresh_token: 'refreshed' })
  })
})
