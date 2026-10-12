import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'

const useMe = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useMe', () => ({ useMe }))
vi.mock('@/components/layout/AvatarMenu', () => ({
  AvatarMenu: () => <button type="button">Account menu</button>,
}))

describe('MarketingHeaderAuth', () => {
  beforeEach(() => useMe.mockReturnValue({ user: null }))

  it('shows Sign in and the persistent Analyze action when logged out', () => {
    render(<MarketingHeaderAuth />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '/new')
    expect(screen.getByRole('link', { name: 'Analyze' })).toHaveClass('bg-brand', 'text-brand-foreground')
  })

  it('keeps the mobile-sheet Analyze action full width', () => {
    render(<MarketingHeaderAuth mode="mobileSheet" />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '/new')
  })

  it('shows only the account menu in the desktop actions when signed in', () => {
    useMe.mockReturnValue({ user: { id: 'user-1' } })
    render(<MarketingHeaderAuth />)
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Analyze' })).not.toBeInTheDocument()
  })
})
