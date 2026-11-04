import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MeProvider } from '@/hooks/useMe'
import { ReportHeaderAuth } from '@/components/layout/ReportHeaderAuth'
import { ReportAuthGateProvider } from '@/components/auth/ReportAuthGate'
import { ReportMobileNav } from '@/components/layout/ReportAppRail'
import { AUTH } from '@/lib/marketing/copy/auth'

const pathname = vi.hoisted(() => ({ value: '/report/audit-1' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))
vi.mock('@/components/auth/AuthFlow', () => ({
  AuthFlow: ({ dialogTitle }: { dialogTitle?: string }) => <div>{dialogTitle}</div>,
}))

describe('ReportHeaderAuth', () => {
  it('shows a Sign up CTA that stays on the report', () => {
    pathname.value = '/report/audit-1'
    render(
      <MeProvider initialUser={null}>
        <ReportAuthGateProvider auditId="audit-1">
          <ReportHeaderAuth />
        </ReportAuthGateProvider>
      </MeProvider>
    )
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('still renders the Sign up CTA off a report route', () => {
    pathname.value = '/'
    render(
      <MeProvider initialUser={null}>
        <ReportAuthGateProvider>
          <ReportHeaderAuth />
        </ReportAuthGateProvider>
      </MeProvider>
    )
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
  })

  it('returns to the mobile menu button after cancelling sign-in from a navigation link', async () => {
    pathname.value = '/sites/site-1'
    render(<MeProvider initialUser={null}><ReportAuthGateProvider auditId="audit-1"><ReportMobileNav /></ReportAuthGateProvider></MeProvider>)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(trigger)
    const menu = await screen.findByRole('dialog', { name: 'Navigation' })
    fireEvent.click(within(menu).getByRole('link', { name: 'Websites' }))
    const auth = await screen.findByRole('dialog', { name: AUTH.signUp.title })
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
    await waitFor(() => expect(auth.contains(document.activeElement)).toBe(true))
    fireEvent.click(within(auth).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
