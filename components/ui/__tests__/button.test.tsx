import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('slots styles onto a single child element', () => {
    render(
      <Button asChild>
        <a href="/dashboard">Dashboard</a>
      </Button>
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })

  it('keeps the slotted element while showing its loading state', () => {
    render(
      <Button asChild loading loadingLabel="Opening dashboard">
        <a href="/dashboard">Dashboard</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Opening dashboard' })
    expect(link).toHaveAttribute('href', '/dashboard')
    expect(link).toHaveAttribute('aria-busy', 'true')
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveAttribute('tabindex', '-1')
    expect(link.querySelector('svg')).toHaveClass('animate-spin')
  })

  it('disables a loading button and exposes its busy state', () => {
    render(
      <Button loading loadingLabel="Saving">
        Save
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Saving' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})
