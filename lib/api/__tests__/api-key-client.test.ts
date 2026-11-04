import { afterEach, expect, it, vi } from 'vitest'
import { ApiKeyAccessError, ApiKeyCreationUnconfirmed, createApiKey, listApiKeys, revokeApiKey } from '../api-key-client'
import { ACCOUNT_OWNER_HEADER, ACCOUNT_CHANGED_CODE } from '../account-response'

const key = `ff_live_${'a'.repeat(64)}`
const created = { id: 'key', name: 'Fixture', key, prefix: 'ff_live_aaaa', lastFour: 'aaaa', client: 'codex',
  scopes: ['flags:read'], expiresAt: '2026-12-03T09:00:00.000Z' }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('returns only a complete one-time secret whose display metadata matches it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(created, { status: 201 })))
  await expect(createApiKey({ name: 'Fixture' })).resolves.toEqual(created)
})

it.each([{ ...created, key: '' }, { ...created, key: `ff_live_${'b'.repeat(64)}` }, { ...created, expiresAt: null }, {}])
('keeps malformed creation receipts unconfirmed', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status: 201 })))
  await expect(createApiKey()).rejects.toBeInstanceOf(ApiKeyCreationUnconfirmed)
})

it('preserves a confirmed refusal instead of calling it an uncertain creation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Choose a supported access level' }, { status: 400 })))
  await expect(createApiKey()).rejects.toThrow('Choose a supported access level')
})

it('bounds a stalled creation body and never replays its POST', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) })
  vi.stubGlobal('fetch', fetcher)
  const result = createApiKey()
  const assertion = expect(result).rejects.toBeInstanceOf(ApiKeyCreationUnconfirmed)
  await vi.advanceTimersByTimeAsync(30_000)
  await assertion
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
})

it('rejects unreadable inventories and unconfirmed revocation receipts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ keys: [] })).mockResolvedValueOnce(Response.json({ ok: false })))
  await expect(listApiKeys()).rejects.toThrow('Could not load developer keys.')
  await expect(revokeApiKey('key')).rejects.toThrow('Could not revoke this key.')
})

it.each(['list', 'create', 'revoke'] as const)('rejects %s success belonging to another account before exposing its payload', async operation => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(operation === 'list' ? [] : operation === 'create' ? created : { ok: true },
    { headers: { [ACCOUNT_OWNER_HEADER]: 'another-owner' } }))
  vi.stubGlobal('fetch', fetcher)
  const result = operation === 'list' ? listApiKeys(undefined, 'owner') : operation === 'create' ? createApiKey({}, undefined, 'owner') : revokeApiKey('key', undefined, 'owner')
  await expect(result).rejects.toMatchObject({ reason: 'account_changed' })
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ [ACCOUNT_OWNER_HEADER]: 'owner' })
})
it('keeps session loss and stale-account refusals distinct from a transport failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({}, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ code: ACCOUNT_CHANGED_CODE }, { status: 409 })))
  await expect(createApiKey({}, undefined, 'owner')).rejects.toBeInstanceOf(ApiKeyAccessError)
  await expect(listApiKeys(undefined, 'owner')).rejects.toMatchObject({ reason: 'account_changed' })
})
