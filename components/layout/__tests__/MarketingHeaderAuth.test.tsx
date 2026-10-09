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
    expect(screen.getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '/#analyze')
  })

  it('keeps the mobile-sheet Analyze action full width', () => {
    render(<MarketingHeaderAuth mode="mobileSheet" />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '/#analyze')
  })

  it('shows Dashboard, account, and Analyze when signed in', () => {
    useMe.mockReturnValue({ user: { id: 'user-1' } })
    render(<MarketingHeaderAuth />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '/#analyze')
  })
})
