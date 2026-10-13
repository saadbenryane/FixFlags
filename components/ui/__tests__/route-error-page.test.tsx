import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MarketingError from '@/app/(marketing)/error'
import AuthError from '@/app/(auth)/error'
import DocsError from '@/app/(docs)/docs/error'
import AppError from '@/app/(app)/error'
import AdminError from '@/app/admin/error'
import { RouteErrorPage } from '@/components/ui/route-error-page'

vi.mock('@/components/layout/site-shell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

describe('RouteErrorPage', () => {
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
