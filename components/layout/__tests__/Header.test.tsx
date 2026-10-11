import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header } from '../header'

vi.mock('@/components/layout/nav-link', () => ({ NavLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/components/layout/MarketingHeaderAuth', () => ({ MarketingHeaderAuth: () => null }))
vi.mock('@/components/auth/SignOutButton', () => ({ SignOutButton: () => null }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/marketing/public-site/PublicInteraction', () => ({ trackPublicNavigation: vi.fn() }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Header surface', () => {
  it('frosts the marketing nav on scroll and clears it when returning to the top', () => {
    const scroll = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toHaveAttribute('data-surface', 'clear')
    scroll.mockReturnValue(200)
    fireEvent.scroll(window)
    expect(header).toHaveAttribute('data-surface', 'frosted')
    scroll.mockReturnValue(0)
    fireEvent.scroll(window)
    expect(header).toHaveAttribute('data-surface', 'clear')
  })

  it('frosts an already scrolled page and follows restored page positions', () => {
    const scroll = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(300)
    render(<Header />)
    expect(screen.getByRole('banner')).toHaveAttribute('data-surface', 'frosted')
    scroll.mockReturnValue(0)
    fireEvent(window, new Event('pageshow'))
    expect(screen.getByRole('banner')).toHaveAttribute('data-surface', 'clear')
  })

  it('keeps compact app chrome frosted at the top', () => {
    render(<Header compact showNavigation={false} />)
    expect(screen.getByRole('banner')).toHaveAttribute('data-surface', 'frosted')
  })
})
