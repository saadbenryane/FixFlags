import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import PostLoginPage from '../page'
import { MeProvider, useMe, type MeUser } from '@/hooks/useMe'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ query: new URLSearchParams(), replace: vi.fn(), push: vi.fn(), enroll: vi.fn(), track: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }), useSearchParams: () => mocks.query }))
vi.mock('@/hooks/useSiteAuthContext', () => ({ useSiteAuthContext: (next: string | null) => ({ isSiteContext: Boolean(next), hostname: 'example.com', siteHref: next }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/auth/PasskeyEnrollPrompt', () => ({ shouldShowPasskeyEnroll: (...args: unknown[]) => mocks.enroll(...args),
  PasskeyEnrollPrompt: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Finish optional enrollment</button> }))

function account(): MeUser {
  return { id: 'claimed-owner', email: 'claimed@example.invalid', name: 'Owner', plan: 'FREE', role: 'user', isAdmin: false,
    checks: { used: 0, pending: 0, limit: 5, isUnlimited: false, remaining: 5, periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z' },
    entitlements: { canExportSummary: true, canAccessPaidFeatures: false, canMonitor: true, canWatchProduct: true }, vibecodingLevel: null, preferredTools: [] }
}
function AccountState() {
  const { user, claimedCount } = useMe({ load: false })
  return <output data-testid="claimed-account">{`${user?.id ?? 'anonymous'}:${claimedCount}`}</output>
}
function Fixture({ visible = true }: { visible?: boolean }) {
  return <MeProvider initialUser={null}>{visible ? <PostLoginPage /> : null}<AccountState /></MeProvider>
}
const receipt = () => Response.json({ user: account(), claimedCount: 1 })
const signups = () => mocks.track.mock.calls.filter(([name]) => name === 'signed_up')
beforeEach(() => {
  vi.clearAllMocks(); mocks.track.mockReset(); mocks.enroll.mockResolvedValue(false)
  mocks.query = new URLSearchParams({ signup: '1', next: '/sites/original?category=search#evidence' })
})
afterEach(() => vi.unstubAllGlobals())

it('claims once during effect replay and tracks the returned account before restoring the exact Site context', async () => {
  const fetch = vi.fn(async () => receipt())
  vi.stubGlobal('fetch', fetch)
  render(<StrictMode><Fixture /></StrictMode>)
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/sites/original?category=search#evidence'))
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/me/claim', expect.objectContaining({ method: 'POST' }))
  expect(mocks.enroll).not.toHaveBeenCalled()
  expect(signups()).toEqual([['signed_up', expect.objectContaining({ user_id: 'claimed-owner', email: 'claimed@example.invalid', method: 'oauth' })]])
})

it('finishes the authorized claim after leaving while retiring enrollment, tracking, and navigation from that screen', async () => {
  let finish!: (response: Response) => void, signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) }))
  const view = render(<Fixture />)
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  view.rerender(<Fixture visible={false} />)
  expect(signal.aborted).toBe(false)
  await act(async () => { finish(receipt()) })
  expect(screen.getByTestId('claimed-account')).toHaveTextContent('claimed-owner:1')
  expect(mocks.enroll).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled(); expect(signups()).toHaveLength(0)
})

it('joins the same claim for a changed destination and hands off only to the current Site context', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const view = render(<Fixture />)
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  mocks.query = new URLSearchParams({ signup: '1', next: '/sites/current?view=pages#pages' })
  await act(async () => { view.rerender(<Fixture />) })
  await act(async () => { finish(receipt()) })
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/sites/current?view=pages#pages'))
  expect(fetch).toHaveBeenCalledOnce(); expect(signups()).toHaveLength(1)
})

it('retires an optional enrollment read after leaving the screen', async () => {
  mocks.query = new URLSearchParams('signup=1')
  let finish!: (enroll: boolean) => void
  mocks.enroll.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', vi.fn(async () => receipt()))
  const view = render(<Fixture />)
  await waitFor(() => expect(mocks.enroll).toHaveBeenCalledOnce())
  const signal = mocks.enroll.mock.calls[0][0] as AbortSignal
  view.rerender(<Fixture visible={false} />)
  expect(signal?.aborted).toBe(true)
  await act(async () => { finish(true) })
  expect(screen.queryByRole('button', { name: 'Finish optional enrollment' })).not.toBeInTheDocument()
  expect(mocks.replace).not.toHaveBeenCalled(); expect(signups()).toHaveLength(0)
})

it('uses the same owned handoff for a refused claim and an explicit retry', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 })).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  render(<Fixture />)
  const retry = await screen.findByRole('button', { name: AUTH.reportContext.retryCta })
  await waitFor(() => expect(retry).toBeEnabled())
  await act(async () => { fireEvent.click(retry); fireEvent.click(retry) })
  expect(fetch).toHaveBeenCalledTimes(2)
  await act(async () => { finish(receipt()) })
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/sites/original?category=search#evidence'))
  expect(signups()).toHaveLength(1)
})

it('completes optional enrollment with the claimed account and restores the dashboard once', async () => {
  mocks.query = new URLSearchParams('signup=1')
  mocks.enroll.mockResolvedValue(true)
  vi.stubGlobal('fetch', vi.fn(async () => receipt()))
  render(<Fixture />)
  const finish = await screen.findByRole('button', { name: 'Finish optional enrollment' })
  expect(mocks.replace).not.toHaveBeenCalled(); expect(signups()).toHaveLength(0)
  fireEvent.click(finish)
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard'))
  expect(signups()).toEqual([['signed_up', expect.objectContaining({ user_id: 'claimed-owner', email: 'claimed@example.invalid' })]])
})

it('restores the destination even when optional signup analytics fails', async () => {
  mocks.track.mockImplementation((name: string) => { if (name === 'signed_up') throw new Error('Analytics unavailable') })
  vi.stubGlobal('fetch', vi.fn(async () => receipt()))
  render(<Fixture />)
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/sites/original?category=search#evidence'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(signups()).toHaveLength(1)
})
