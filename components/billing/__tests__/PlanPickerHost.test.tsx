import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { PlanPickerHost } from '../PlanPickerHost'

const mocks = vi.hoisted(() => ({ user: { id: 'owner', plan: 'TEAM' } as { id: string; plan: string } | null, replace: vi.fn(), dismissed: false, reset: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: mocks.user, isLoading: false }) }))
vi.mock('../PlanPickerDialog', () => ({ isPlanPickerDismissed: () => mocks.dismissed, resetPlanPickerDismissal: mocks.reset,
  PlanPickerDialog: ({ open, onOpenChange, onDismiss, fallbackPath }: { open: boolean; onOpenChange: (open: boolean) => void; onDismiss?: () => void; fallbackPath?: string }) =>
    open ? <section data-testid="plan-picker" data-fallback={fallbackPath}><button onClick={() => { onOpenChange(false); onDismiss?.() }}>Skip plans</button></section> : null }))
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'owner', plan: 'TEAM' }; mocks.dismissed = false })

it.each(['/\\another.example', '/%5canother.example', '/%2f%2fanother.example', '//another.example', 'https://another.example', '/\nanother.example'])
('keeps an unsafe return destination out of onboarding: %j', next => {
  render(<PlanPickerHost source="post_signin" next={next} />)
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard')
})

it('preserves a complete Site return destination after a paid plan or a prior dismissal', () => {
  const next = '/sites/original/flags/captured?view=pages#evidence'
  const view = render(<PlanPickerHost source="post_signin" next={next} />)
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(next)
  view.unmount(); mocks.replace.mockClear()
  mocks.user = { id: 'owner', plan: 'FREE' }; mocks.dismissed = true
  render(<PlanPickerHost source="post_signin" next={next} />)
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(next)
})

it('passes only a safe destination to the picker and uses it when the customer closes', () => {
  mocks.user = { id: 'owner', plan: 'FREE' }
  render(<PlanPickerHost source="post_signup" next="/%2f%2fanother.example" />)
  expect(screen.getByTestId('plan-picker')).toHaveAttribute('data-fallback', '/dashboard')
  fireEvent.click(screen.getByRole('button', { name: 'Skip plans' }))
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard')
})

it('does not propagate an unsafe destination into a new sign-in journey', () => {
  mocks.user = null
  render(<PlanPickerHost source="post_signin" next="/%5canother.example" />)
  const destination = new URL(mocks.replace.mock.calls[0][0], 'https://fixflags.invalid')
  expect(destination.pathname).toBe('/sign-up')
  expect(destination.searchParams.has('next')).toBe(false)
})
