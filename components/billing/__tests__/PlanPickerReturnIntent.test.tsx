import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PlanPickerHost } from '../PlanPickerHost'
import { PlanPickerDialog } from '../PlanPickerDialog'

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), checkout: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => '/onboarding/plans', useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: { id: 'owner', email: 'owner@example.com', plan: 'FREE' }, isLoading: false }) }))
vi.mock('@/lib/audit/active-audit', () => ({ getActiveAudit: () => ({ auditId: 'remembered-audit', siteId: 'remembered-site' }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/billing/paid-open', () => ({ isPaidCheckoutGatedClient: () => true }))
vi.mock('@/lib/billing/client-checkout', () => ({ requestPlanCheckout: (...args: unknown[]) => mocks.checkout(...args) }))

beforeEach(() => { vi.clearAllMocks(); sessionStorage.removeItem('ff:plan-picker-dismissed') })
afterEach(() => { vi.restoreAllMocks() })

function useMobileViewport() {
  const media = window.matchMedia('(max-width: 639px)')
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...media, matches: query === '(max-width: 639px)', media: query }))
}

it.each([
  '/sites/current/flags/flag-2?view=pages#evidence',
  '/dashboard?url=' + encodeURIComponent('https://example.com/plans/?return=/account/#/pricing'),
  '/dashboard',
])('continues Free onboarding once to the explicit destination: %s', async next => {
  render(<PlanPickerHost source="post_signup" next={next} />)
  const start = await screen.findByRole('button', { name: 'Start free' })
  expect(start).toBeEnabled()
  fireEvent.click(start)
  await waitFor(() => expect(mocks.push).toHaveBeenCalledExactlyOnceWith(next))
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.checkout).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it.each([undefined, '//another.example'])('preserves the remembered Site shortcut without a safe explicit destination: %j', async next => {
  render(<PlanPickerHost source="post_signup" next={next} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Start free' }))
  await waitFor(() => expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/sites/remembered-site'))
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('uses the sanitized return destination when the customer dismisses plans', async () => {
  const next = '/sites/current?view=pages#evidence'
  render(<PlanPickerHost source="post_signup" next={next} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(next))
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('preserves the explicit Free continuation through the mobile sheet', async () => {
  useMobileViewport()
  const next = '/sites/current?view=pages#evidence'
  render(<PlanPickerHost source="post_signup" next={next} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Start free' }))
  await waitFor(() => expect(mocks.push).toHaveBeenCalledExactlyOnceWith(next))
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('offers one mobile dismissal control that returns to the requested Site once', async () => {
  useMobileViewport()
  const next = '/sites/current?view=pages#evidence'
  render(<PlanPickerHost source="post_signup" next={next} />)
  await screen.findByRole('button', { name: 'Start free' })
  const close = screen.getAllByRole('button', { name: 'Close' })
  expect(close).toHaveLength(1)
  fireEvent.click(close[0])
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(next))
  expect(mocks.push).not.toHaveBeenCalled()
})

it('keeps mobile onboarding open on Escape until a choice or explicit dismissal', async () => {
  useMobileViewport()
  render(<PlanPickerHost source="post_signup" next="/sites/current" />)
  const dialog = await screen.findByRole('dialog')
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(dialog).toBeVisible()
})

it('allows Escape to dismiss the mobile Billing picker', async () => {
  useMobileViewport()
  const onOpenChange = vi.fn(), onDismiss = vi.fn()
  render(<PlanPickerDialog open source="billing" lockDismissal={false} onOpenChange={onOpenChange} onDismiss={onDismiss} />)
  fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
  expect(onDismiss).toHaveBeenCalledOnce()
})

it('remembers an explicit Free choice so the next sign-in does not ask again', async () => {
  const next = '/sites/current'
  const signup = render(<PlanPickerHost source="post_signup" next={next} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Start free' }))
  await waitFor(() => expect(mocks.push).toHaveBeenCalledExactlyOnceWith(next))
  signup.unmount(); mocks.push.mockClear(); mocks.replace.mockClear()
  render(<PlanPickerHost source="post_signin" next={next} />)
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(next))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('keeps paid waitlist navigation with the selected action rather than the host fallback', async () => {
  render(<PlanPickerHost source="post_signup" next="/sites/current" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Join Pro waitlist' }))
  await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce())
  expect(new URL(mocks.push.mock.calls[0][0], 'https://fixflags.invalid').pathname).toBe('/waitlist/pro')
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('keeps the current Free plan non-mutating in Billing', async () => {
  render(<PlanPickerDialog open onOpenChange={() => {}} source="billing" />)
  expect(await screen.findByRole('button', { name: 'Current plan' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Start free' })).not.toBeInTheDocument()
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('identifies Free as available while paid plans are waitlisted', async () => {
  render(<PlanPickerDialog open onOpenChange={() => {}} source="billing" />)
  const currentFree = await screen.findByRole('button', { name: 'Current plan' })
  expect(within(currentFree.parentElement!).getByText('Available now')).toBeVisible()
})
