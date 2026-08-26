import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MeProvider } from '@/hooks/useMe'
import { ReportHeaderAuth } from '@/components/layout/ReportHeaderAuth'

const pathname = vi.hoisted(() => ({ value: '/report/audit-1' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

describe('ReportHeaderAuth', () => {
  it('returns to the current report after sign-in', () => {
    pathname.value = '/report/audit-1'
    render(
      <MeProvider initialUser={null}>
        <ReportHeaderAuth />
      </MeProvider>
    )
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Freport%2Faudit-1&from=report'
    )
  })

  it('uses plain sign-in when there is no report to claim', () => {
    pathname.value = '/'
    render(
      <MeProvider initialUser={null}>
        <ReportHeaderAuth />
      </MeProvider>
    )
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/sign-in')
  })
})
