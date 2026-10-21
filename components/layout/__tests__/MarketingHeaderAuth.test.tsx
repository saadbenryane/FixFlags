import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'

const useMe = vi.hoisted(() => vi.fn())
const navigation = vi.hoisted(() => ({ pathname: '/', search: '' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useSearchParams: () => new URLSearchParams(navigation.search) }))

vi.mock('@/hooks/useMe', () => ({ useMe }))
vi.mock('@/components/layout/AvatarMenu', () => ({
  AvatarMenu: () => <button type="button">Account menu</button>,
}))

describe('MarketingHeaderAuth', () => {
  beforeEach(() => { useMe.mockReturnValue({ user: null }); navigation.pathname = '/'; navigation.search = ''; window.history.replaceState({}, '', '/') })

  it('retains a private Site destination and category when its session is unavailable', () => {
    navigation.pathname = '/sites/private-site'
    navigation.search = 'category=accessibility'
    window.history.replaceState({}, '', '/sites/private-site?category=accessibility#evidence')
    render(<MarketingHeaderAuth />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fprivate-site%3Fcategory%3Daccessibility%23evidence')
  })

  it('shows Sign in and the persistent website-check action when logged out', () => {
    render(<MarketingHeaderAuth />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Check website' })).toHaveAttribute('href', '/new')
    expect(screen.getByRole('link', { name: 'Check website' })).toHaveClass('bg-brand', 'text-brand-foreground')
  })

  it('keeps the mobile-sheet website-check action full width', () => {
    render(<MarketingHeaderAuth mode="mobileSheet" />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Check website' })).toHaveAttribute('href', '/new')
  })

  it('shows only the account menu in the desktop actions when signed in', () => {
    useMe.mockReturnValue({ user: { id: 'user-1' } })
    render(<MarketingHeaderAuth />)
    expect(screen.queryByRole('link', { name: 'Websites' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Check website' })).not.toBeInTheDocument()
  })
})
