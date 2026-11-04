import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const selection = JSON.stringify(['owner', 'site', 'source-flag', 'incident', 'audit'])
let values: Map<string, string>
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> }
beforeEach(() => {
  vi.resetModules()
  values = new Map()
  storage = { getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }), removeItem: vi.fn((key: string) => { values.delete(key) }) }
  vi.stubGlobal('window', {})
  vi.stubGlobal('sessionStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

it('restores the exact declaration and key after a page reload and keeps retries immutable', async () => {
  const first = await import('../client-verification-intent')
  const submitted = first.startVerificationIntent(selection, 'incident', '  Published the contact repair.  ')
  expect(submitted.changeSummary).toBe('Published the contact repair.')
  vi.resetModules()
  const reloaded = await import('../client-verification-intent')
  expect(reloaded.readVerificationIntent(selection, 'incident')).toEqual(submitted)
  expect(reloaded.startVerificationIntent(selection, 'incident', 'A later draft')).toEqual(submitted)
})

it('keeps account, Site, source, and reference changes outside the original retry', async () => {
  const intents = await import('../client-verification-intent')
  const submitted = intents.startVerificationIntent(selection, 'incident', 'Original declaration')
  for (const index of [0, 1, 2, 3, 4]) {
    const scope = JSON.parse(selection) as string[]
    scope[index] = 'changed'
    const next = JSON.stringify(scope)
    expect(intents.readVerificationIntent(next, 'incident')).toBeNull()
    expect(intents.startVerificationIntent(next, 'incident', 'New declaration').key).not.toBe(submitted.key)
  }
})

it('rejects a stored declaration whose source or reference does not match the requested scope', async () => {
  const intents = await import('../client-verification-intent')
  const submitted = intents.startVerificationIntent(selection, 'incident', 'Original declaration')
  const key = [...values.keys()][0]
  values.set(key, JSON.stringify({ ...submitted, flagId: 'another-incident' }))
  vi.resetModules()
  const reloaded = await import('../client-verification-intent')
  expect(reloaded.readVerificationIntent(selection, 'incident')).toBeNull()
  values.set(key, JSON.stringify({ ...submitted, selection: 'another-account-source' }))
  expect(reloaded.readVerificationIntent(selection, 'incident')).toBeNull()
})

it('retains an interrupted declaration in the tab when browser storage is unavailable', async () => {
  storage.getItem.mockImplementation(() => { throw new Error('Storage disabled') })
  storage.setItem.mockImplementation(() => { throw new Error('Storage disabled') })
  const intents = await import('../client-verification-intent')
  const submitted = intents.startVerificationIntent(selection, 'incident', 'Original declaration')
  expect(intents.readVerificationIntent(selection, 'incident')).toEqual(submitted)
  expect(intents.startVerificationIntent(selection, 'incident', '')).toEqual(submitted)
})

it('retires a confirmed declaration and prevents an old completion from consuming its replacement', async () => {
  const intents = await import('../client-verification-intent')
  const submitted = intents.startVerificationIntent(selection, 'incident', 'Original declaration')
  intents.completeVerificationIntent(selection, submitted)
  expect(values.size).toBe(0)
  expect(intents.readVerificationIntent(selection, 'incident')).toBeNull()
  const next = intents.startVerificationIntent(selection, 'incident', 'A second published change')
  expect(next.key).not.toBe(submitted.key)
  intents.completeVerificationIntent(selection, submitted)
  expect(intents.readVerificationIntent(selection, 'incident')).toEqual(next)
})

it('does not resurrect a confirmed declaration when persistent cleanup fails', async () => {
  const intents = await import('../client-verification-intent')
  const submitted = intents.startVerificationIntent(selection, 'incident', 'Original declaration')
  storage.removeItem.mockImplementation(() => { throw new Error('Storage disabled') })
  intents.completeVerificationIntent(selection, submitted)
  expect(intents.readVerificationIntent(selection, 'incident')).toBeNull()
  expect(intents.startVerificationIntent(selection, 'incident', 'A second change').key).not.toBe(submitted.key)
})
