import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiKeyManager } from '../ApiKeyManager'
import { API_KEY_COPY as C } from '@/lib/marketing/copy/terminology'

const account = vi.hoisted(() => ({ id: 'owner' as string | null, isLoading: false }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: account.id ? { id: account.id } : null, isLoading: account.isLoading }) }))
function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { 'x-fixflags-account-id': 'owner', ...Object.fromEntries(new Headers(init.headers)) } })
}

const secret = `ff_live_${'a'.repeat(64)}`
const created = { id: 'key-1', name: 'Repair agent', key: secret, prefix: 'ff_live_aaaa', lastFour: 'aaaa', client: 'codex',
  scopes: ['flags:read'], expiresAt: '2026-12-03T09:00:00.000Z' }
const summary = { ...created, key: undefined, lastUsed: null, createdAt: '2026-11-03T09:00:00.000Z' }
beforeEach(() => { account.id = 'owner'; account.isLoading = false; Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
function fill() {
  const input = screen.getByRole('textbox', { name: 'Key name' })
  fireEvent.change(input, { target: { value: 'Repair agent' } })
  return input.closest('form')!
}

it('continues a confirmed creation at its one-time key without waiting for inventory', async () => {
  let reads = 0
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') return json(created, { status: 201 })
    return ++reads === 1 ? json([]) : new Promise<Response>(() => {})
  }))
  render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fill()
  const create = screen.getByRole('button', { name: 'Create key' })
  create.focus(); fireEvent.click(create)
  const key = await screen.findByRole('textbox', { name: 'New API key' })
  await waitFor(() => expect(key).toHaveFocus())
  expect(key).toHaveProperty('selectionStart', 0)
  expect(key).toHaveProperty('selectionEnd', secret.length)
  expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
})

it.each(['creation', 'revocation'] as const)('preserves a deliberate focus change while %s is pending', async mode => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => options?.method === (mode === 'creation' ? 'POST' : 'DELETE')
    ? new Promise<Response>(resolve => { finish = resolve })
    : Promise.resolve(json(mode === 'creation' ? [] : [summary]))))
  render(<><button>Continue reading setup</button><ApiKeyManager ownerId="owner" /></>)
  await screen.findByRole('heading', { name: 'Active keys' })
  if (mode === 'creation') fill()
  const action = await screen.findByRole('button', { name: mode === 'creation' ? 'Create key' : 'Revoke' })
  action.focus(); fireEvent.click(action)
  const outside = screen.getByRole('button', { name: 'Continue reading setup' })
  outside.focus()
  await act(async () => { finish(mode === 'creation' ? json(created, { status: 201 }) : json({ ok: true })) })
  expect(outside).toHaveFocus()
})

it.each(['empty', 'remaining'] as const)('returns a confirmed revocation to the active-key list when it is %s', async mode => {
  const remaining = { ...summary, id: 'key-2', name: 'Other agent' }
  let revoked = false
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'DELETE') { revoked = true; return json({ ok: true }) }
    return json(revoked ? mode === 'empty' ? [] : [remaining] : [summary, ...(mode === 'remaining' ? [remaining] : [])])
  }))
  render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('Repair agent')
  const revoke = screen.getAllByRole('button', { name: 'Revoke' })[0]
  revoke.focus(); fireEvent.click(revoke)
  await screen.findByText('Key revoked.')
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Active keys' })).toHaveFocus())
  expect(revoke).not.toBeInTheDocument()
})

it('keeps a confirmed one-time key available when its inventory refresh fails, without duplicating creation', async () => {
  let reads = 0
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
    ? json(created, { status: 201 })
    : ++reads === 1 ? json([]) : json({}, { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  render(<ApiKeyManager ownerId="owner" client="codex" />)
  await screen.findByText('No active keys.')
  const form = fill()
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(await screen.findByRole('alert')).toHaveTextContent(C.listFailed)
  expect(screen.getByRole('textbox', { name: 'New API key' })).toHaveValue(secret)
  expect(screen.getByText('Key created. Copy it now. FixFlags will not show it again.')).toBeVisible()
  expect(screen.queryByText('No active keys.')).not.toBeInTheDocument()
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })) })
  expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(secret)
  expect(screen.getByRole('button', { name: 'Copied' })).toBeEnabled()
})

it('keeps a previously revealed key when creating another key is refused', async () => {
  let creates = 0
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
    ? ++creates === 1 ? json(created, { status: 201 }) : json({ message: 'Key limit reached' }, { status: 409 })
    : json([])))
  render(<ApiKeyManager ownerId="owner" client="codex" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  expect(await screen.findByRole('textbox', { name: 'New API key' })).toHaveValue(secret)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create key' })).toBeEnabled())
  fireEvent.submit(screen.getByRole('textbox', { name: 'Key name' }).closest('form')!)
  expect(await screen.findByText('Key limit reached')).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'New API key' })).toHaveValue(secret)
})

it('requires a fresh inventory read after an unconfirmed creation, preserving its draft without an automatic POST retry', async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
    ? json({ ...created, key: '' }, { status: 201 }) : json([]))
  vi.stubGlobal('fetch', fetcher)
  render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  expect(await screen.findByText(C.createUnconfirmed)).toBeVisible()
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(screen.queryByText('No active keys.')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Key name' })).toHaveValue('Repair agent')
  expect(screen.getByRole('button', { name: 'Create key' })).toBeDisabled()
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: C.retryList }))
  await screen.findByText('No active keys.')
  expect(screen.getByRole('button', { name: 'Create key' })).toBeEnabled()
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('keeps unreadable inventory separate from an empty list and ignores a timed-out read during retry', async () => {
  vi.useFakeTimers()
  let first!: (response: Response) => void, retry!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { retry = resolve }))
  vi.stubGlobal('fetch', fetcher)
  render(<ApiKeyManager ownerId="owner" />)
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(C.listFailed)
  expect(screen.queryByText('No active keys.')).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: C.retryList })
  button.focus()
  act(() => { fireEvent.click(button); fireEvent.click(button) })
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { first(json([])) })
  expect(screen.queryByText('No active keys.')).not.toBeInTheDocument()
  await act(async () => { retry(json([summary])) })
  expect(screen.getByText('Repair agent')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Active keys' })).toHaveFocus()
})

it('keeps a key visible after an unconfirmed revocation and removes its secret only after confirmed revocation', async () => {
  let deletes = 0, made = false
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') { made = true; return json(created, { status: 201 }) }
    if (options?.method === 'DELETE') return ++deletes === 1 ? json({ ok: false }) : json({ ok: true })
    return json(made && deletes < 2 ? [summary] : [])
  }))
  render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  const key = await screen.findByRole('textbox', { name: 'New API key' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Revoke' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
  expect(await screen.findByText(C.revokeFailed)).toBeVisible()
  expect(key).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revoke' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
  expect(await screen.findByText('Key revoked.')).toBeVisible()
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
})

it('can revoke the confirmed new key even when its inventory remains unavailable', async () => {
  let reads = 0
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') return json(created, { status: 201 })
    if (options?.method === 'DELETE') return json({ ok: true })
    return ++reads === 1 ? json([]) : json({}, { status: 503 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  expect(await screen.findByRole('alert')).toHaveTextContent(C.listFailed)
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
  expect(await screen.findByText('Key revoked.')).toBeVisible()
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledWith('/api/api-keys?id=key-1', expect.objectContaining({ method: 'DELETE' }))
})

it('cancels creation when leaving and does not reveal its late secret', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockResolvedValueOnce(json([]))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  const signal = fetcher.mock.calls[1][1].signal as AbortSignal
  view.unmount()
  await act(async () => { finish(json(created, { status: 201 })) })
  expect(signal.aborted).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
})

it('withholds a creation receipt from another account and offers a current-account refresh', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
    ? json(created, { headers: { 'x-fixflags-account-id': 'another-owner' } }) : json([])))
  render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  expect(await screen.findByRole('alert')).toHaveTextContent(C.accountChanged)
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create key' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: C.refreshAccount })).toBeEnabled()
})

it('retires the revealed secret after a signed-out revocation response and preserves the setup destination', async () => {
  let made = false
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') { made = true; return json(created, { status: 201 }) }
    if (options?.method === 'DELETE') return json({}, { status: 401 })
    return json(made ? [summary] : [])
  }))
  render(<ApiKeyManager ownerId="owner" returnPath="/dashboard/mcp-setup?builder=codex" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  await screen.findByRole('textbox', { name: 'New API key' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Revoke' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(C.accountUnavailable)
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(screen.queryByText('Repair agent')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fdashboard%2Fmcp-setup%3Fbuilder%3Dcodex')
})

it('cancels pending creation when its concurrent inventory read reports session loss', async () => {
  let read!: (response: Response) => void, write!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { read = resolve }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { write = resolve }))
  vi.stubGlobal('fetch', fetcher)
  render(<ApiKeyManager ownerId="owner" />)
  fireEvent.submit(fill())
  const signal = fetcher.mock.calls[1][1].signal as AbortSignal
  await act(async () => { read(json({}, { status: 401 })) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(C.accountUnavailable)
  await act(async () => { write(json(created, { status: 201 })) })
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('retires the old account view immediately and starts the next owner with no secret or draft', async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? json(created, { status: 201 })
    : json([], { headers: { 'x-fixflags-account-id': account.id! } }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<ApiKeyManager ownerId="owner" />)
  await screen.findByText('No active keys.')
  fireEvent.submit(fill())
  await screen.findByRole('textbox', { name: 'New API key' })
  account.id = 'next-owner'
  view.rerender(<ApiKeyManager ownerId="owner" />)
  expect(screen.getByRole('alert')).toHaveTextContent(C.accountChanged)
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  view.rerender(<ApiKeyManager ownerId="next-owner" />)
  await screen.findByText('No active keys.')
  expect(screen.getByRole('textbox', { name: 'Key name' })).toHaveValue('')
  expect(screen.queryByRole('textbox', { name: 'New API key' })).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenLastCalledWith('/api/api-keys', expect.objectContaining({ headers: { 'x-fixflags-account-id': 'next-owner' } }))
})
