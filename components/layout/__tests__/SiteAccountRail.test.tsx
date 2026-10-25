import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteAccountRail } from '../SiteAccountRail'

const state = vi.hoisted(() => ({ open: vi.fn(), pathname: '/sites/site-1', user: { id: 'owner', email: 'owner@example.com', isAdmin: false } as { id: string; email: string; isAdmin: boolean } | null }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/auth/ReportAuthGate', () => ({ useReportAuthGate: () => ({ open: state.open }) }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: state.user }) }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => <button>Theme</button> }))
vi.mock('@/components/layout/AvatarMenu', () => ({ AvatarMenu: () => <button>Account menu</button> }))

describe('persistent account navigation within a website', () => {
  beforeEach(() => { state.pathname = '/sites/site-1'; state.user = { id: 'owner', email: 'owner@example.com', isAdmin: false } })
  it('keeps Websites selected and every account destination reachable from a nested site page', () => {
    state.pathname = '/sites/site-1/settings'
    render(<SiteAccountRail />)
    expect(screen.getByRole('link', { name: 'Websites' })).toHaveAttribute('aria-current', 'page')
    for (const label of ['Billing', 'Docs', 'Help', 'Account']) expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FixFlags' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'API keys' })).not.toBeInTheDocument()
  })
  it('only exposes administrator navigation for an administrator', () => {
    state.user!.isAdmin = true
    render(<SiteAccountRail />)
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
  })
  it('retains main navigation for visitors and gates account destinations when clicked', () => {
    state.user = null
    render(<SiteAccountRail />)
    expect(screen.getByRole('complementary', { name: 'App' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    const websites = screen.getByRole('link', { name: 'Websites' })
    fireEvent.click(websites)
    expect(state.open).toHaveBeenCalledWith({ reason: 'create-account', nextPath: '/dashboard', trigger: websites })
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })
})
