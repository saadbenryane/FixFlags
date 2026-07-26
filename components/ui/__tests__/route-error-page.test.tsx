import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorPage } from '@/components/ui/route-error-page'

describe('RouteErrorPage', () => {
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
