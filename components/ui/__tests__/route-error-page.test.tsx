import { act, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MarketingError from '@/app/(marketing)/error'
import AuthError from '@/app/(auth)/error'
import DocsError from '@/app/(docs)/docs/error'
import AppError from '@/app/(app)/error'
import AdminError from '@/app/admin/error'
import { RouteErrorPage } from '@/components/ui/route-error-page'
import RootError from '@/app/error'
import GlobalError from '@/app/global-error'
import BillingError from '@/app/(app)/billing/error'
import ProductError from '@/app/(app)/products/[id]/error'
import ReportError from '@/app/report/[id]/error'
import RepoError from '@/app/report/repo/[id]/error'
import CompareError from '@/app/compare/[id]/error'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

vi.mock('@/components/layout/site-shell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock('@/components/layout/audit-shell', () => ({ AuditShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
vi.mock('@/components/help/HelpSupportActions', () => ({ HelpSupportActions: () => null }))

describe('RouteErrorPage', () => {
  it.each([
    { name: 'root', Component: RootError }, { name: 'app', Component: AppError },
    { name: 'auth', Component: AuthError }, { name: 'billing', Component: BillingError },
    { name: 'legacy Site', Component: ProductError }, { name: 'report', Component: ReportError },
    { name: 'repository report', Component: RepoError }, { name: 'comparison', Component: CompareError },
    { name: 'documentation', Component: DocsError }, { name: 'admin', Component: AdminError },
  ])('uses the native refetching retry for $name recovery', ({ Component }) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const reset = vi.fn(), retry = vi.fn()
      render(<Component error={new Error('temporary server read failure')} reset={reset} retry={retry} />)
      fireEvent.click(screen.getByRole('button', { name: SYSTEM_COPY.actions.retry }))
      expect(retry).toHaveBeenCalledOnce()
      expect(reset).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })

  it.each([null, 'A thrown string', { detail: 'Private internal details' }])('keeps recovery available for an unknown thrown value: %j', error => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const retry = vi.fn()
      render(<RouteErrorPage error={error} reset={vi.fn()} retry={retry} event="ui.test.error" title="Could not load page"
        description="Try again or return." returnHref="/dashboard" returnLabel="Dashboard" />)
      fireEvent.click(screen.getByRole('button', { name: SYSTEM_COPY.actions.retry }))
      expect(retry).toHaveBeenCalledOnce()
      expect(screen.getByRole('heading', { name: 'Could not load page' })).toBeVisible()
      expect(document.body).not.toHaveTextContent('Private internal details')
    } finally { log.mockRestore() }
  })

  it('exposes retry progress and keeps the escape link available during recovery', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let finish!: () => void
    const retry = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    try {
      render(<RouteErrorPage error={new Error('temporary read failure')} reset={vi.fn()} retry={retry} event="ui.test.error"
        title="Could not load page" description="Try again or return." returnHref="/dashboard" returnLabel="Dashboard" />)
      const button = screen.getByRole('button', { name: SYSTEM_COPY.actions.retry })
      fireEvent.click(button); fireEvent.click(button)
      expect(retry).toHaveBeenCalledOnce()
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
      await act(async () => { finish() })
      expect(button).toBeEnabled()
      expect(button).not.toHaveAttribute('aria-busy')
    } finally { log.mockRestore() }
  })

  it.each([null, 'unexpected'])('can render global recovery for a non-Error value: %j', error => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(renderToString(<GlobalError error={error} reset={vi.fn()} retry={vi.fn()} />)).toContain(SYSTEM_COPY.errors.criticalTitle)
    } finally { log.mockRestore() }
  })

  it.each([MarketingError, AuthError, DocsError, AppError, AdminError])('keeps the owning layout when a child route fails (%s)', Component => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reset = vi.fn()
    render(<main><Component error={new Error('controlled route failure')} reset={reset} /></main>)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledOnce()
    log.mockRestore()
  })
  it('renders recovery actions and reports the route error once', () => {
    const reset = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <RouteErrorPage
        error={Object.assign(new Error('broken'), { digest: 'abc' })}
        reset={reset}
        event="ui.test.error"
        title="Could not load page"
        description="Try again or return."
        returnHref="/dashboard"
        returnLabel="Dashboard"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
