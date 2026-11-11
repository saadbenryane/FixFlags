import Link from 'next/link'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppPanel } from '../AppPanel'
import { APP_NAV_COPY } from '@/lib/marketing/copy/navigation'

const state = vi.hoisted(() => ({ open: vi.fn(), pathname: '/sites/site-1', user: { id: 'owner', email: 'owner@example.com', isAdmin: false } as { id: string; email: string; isAdmin: boolean } | null }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/auth/ReportAuthGate', () => ({ useReportAuthGate: () => ({ open: state.open }) }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: state.user }) }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => <button>Theme</button> }))
vi.mock('@/components/layout/AvatarMenu', () => ({ AvatarMenu: () => <button>Account menu</button> }))

describe('app panel', () => {
  beforeEach(() => { state.pathname = '/sites/site-1'; state.user = { id: 'owner', email: 'owner@example.com', isAdmin: false } })
  it('shows the website being viewed, its sections, and one account menu instead of account links', () => {
    render(<AppPanel current={{ id: 'site-1', host: 'example.com' }} navigation={<nav aria-label="Site"><Link href="/sites/site-1">Overview</Link></nav>} />)
    expect(screen.getByRole('button', { name: `${APP_NAV_COPY.switcher.label}: example.com` })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Site' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    for (const label of ['Billing', 'API keys', 'Docs', 'Help', 'Account']) expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FixFlags' })).toHaveAttribute('href', '/dashboard')
  })
  it('opens on all websites when no website is chosen', () => {
    state.pathname = '/dashboard'
    render(<AppPanel />)
    expect(screen.getByRole('button', { name: `${APP_NAV_COPY.switcher.label}: ${APP_NAV_COPY.switcher.all}` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Websites' })).toHaveAttribute('aria-current', 'page')
  })
  it('keeps the websites link for visitors, gates it on click, and offers sign in', () => {
    state.user = null
    render(<AppPanel />)
    expect(screen.getByRole('complementary', { name: 'App' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Choose a website/ })).not.toBeInTheDocument()
    const websites = screen.getByRole('link', { name: 'Websites' })
    fireEvent.click(websites)
    expect(state.open).toHaveBeenCalledWith({ reason: 'create-account', nextPath: '/dashboard', trigger: websites })
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })
})
