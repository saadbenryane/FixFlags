import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MeProvider } from '@/hooks/useMe'
import { ReportHeaderAuth } from '@/components/layout/ReportHeaderAuth'
import { ReportAuthGateProvider } from '@/components/auth/ReportAuthGate'

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
})
