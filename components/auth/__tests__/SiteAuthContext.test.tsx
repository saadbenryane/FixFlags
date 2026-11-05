import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteAuthContext } from '../SiteAuthContext'
import PostLoginPage from '@/app/(auth)/post-login/page'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ claim: vi.fn(), replace: vi.fn(), next: '/sites/site?category=conversion&flag=incident#evidence' }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ next: mocks.next }),
}))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: null, isLoading: false, claimedCount: null,
  error: 'Saved results could not be claimed.', claimAnonymous: mocks.claim }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/components/auth/PasskeyEnrollPrompt', () => ({ PasskeyEnrollPrompt: () => null, shouldShowPasskeyEnroll: () => false }))
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

it('shows the current Site and keeps its exact return link while a new identity is unavailable', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site', hostname: 'current.example' }))
    .mockResolvedValueOnce(Response.json({}, { status: 404 }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<SiteAuthContext next={mocks.next} />)
  expect(screen.getByRole('region', { name: AUTH.reportContext.regionLabel })).toBeVisible()
  expect(await screen.findByText(AUTH.reportContext.title('current.example'))).toBeVisible()
  expect(screen.getByRole('link', { name: AUTH.reportContext.backCta })).toHaveAttribute('href', mocks.next)
  view.rerender(<SiteAuthContext next="/sites/next?flag=other" />)
  expect(screen.queryByText(AUTH.reportContext.title('current.example'))).not.toBeInTheDocument()
  expect(screen.getByText(AUTH.reportContext.loadingTitle)).toBeVisible()
  await act(async () => {})
  expect(screen.getByRole('link', { name: AUTH.reportContext.backCta })).toHaveAttribute('href', '/sites/next?flag=other')
})

it('keeps a failed Site claim on recovery with a back action instead of offering to bypass the claim', async () => {
  mocks.claim.mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ siteId: 'site', hostname: 'current.example' })))
  render(<PostLoginPage />)
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.reportContext.saveError)
  expect(screen.getByRole('link', { name: AUTH.reportContext.backCta })).toHaveAttribute('href', mocks.next)
  expect(screen.queryByRole('button', { name: AUTH.postLogin.continueCta })).not.toBeInTheDocument()
  await act(async () => {})
  expect(mocks.claim).toHaveBeenCalledOnce()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: AUTH.reportContext.retryCta })) })
  expect(mocks.claim).toHaveBeenCalledTimes(2)
  expect(mocks.replace).not.toHaveBeenCalled()
})

it('renders no Site save context for a general dashboard sign-in', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<SiteAuthContext next="/dashboard" />)
  expect(screen.queryByRole('region', { name: AUTH.reportContext.regionLabel })).not.toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
})
