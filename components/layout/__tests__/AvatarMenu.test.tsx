// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarNav } from '@/components/layout/sidebar'
import { AUTH } from '@/lib/marketing/copy/auth'

const signOut = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/lib/auth/client-sign-out', () => ({
  signOutClient: (...args: unknown[]) => signOut(...args),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

afterEach(() => { vi.resetAllMocks() })

const user: MeUser = {
  id: 'user-1',
  email: 'founder@example.com',
  name: 'Founder',
  plan: 'pro',
  role: 'user',
  isAdmin: false,
  checks: {
    used: 1,
    pending: 0,
    limit: 20,
    isUnlimited: false,
    remaining: 19,
    periodStart: '2026-08-01',
    periodEnd: '2026-09-01',
  },
  entitlements: {
    canExportSummary: true,
    canAccessPaidFeatures: true,
    canMonitor: true,
    canWatchProduct: true,
  },
  vibecodingLevel: null,
  preferredTools: [],
}

describe('AvatarMenu', () => {
  it('opens Settings, Help, and Log out actions', async () => {
    signOut.mockResolvedValue({ data: { success: true }, error: null })

    render(
      <MeProvider initialUser={user}>
        <AvatarMenu user={user} />
      </MeProvider>
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(await screen.findByRole('menuitem', { name: 'Websites' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(screen.getByRole('menuitem', { name: 'Account settings' })).toHaveAttribute(
      'href',
      '/settings'
    )
    expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/help')

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
    })
  })

  it('keeps progress visible in the open menu and prevents another sign-out until completion', async () => {
    let finish!: () => void
    signOut.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    render(<MeProvider initialUser={user}><AvatarMenu user={user} /></MeProvider>)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: AUTH.signOut.menuCta }))
    const working = screen.getByRole('menuitem', { name: AUTH.signOut.working })
    expect(working).toHaveAttribute('aria-disabled', 'true')
    expect(working).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(working)
    expect(signOut).toHaveBeenCalledOnce()
    await act(async () => { finish() })
    expect(screen.getByRole('menuitem', { name: AUTH.signOut.menuCta })).not.toHaveAttribute('aria-disabled', 'true')
  })
})

describe('SidebarNav', () => {
  it('keeps Settings as the last rail item', () => {
    render(
      <TooltipProvider>
        <SidebarNav compact />
      </TooltipProvider>
    )

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links.at(-1)).toBe('/settings')
    expect(links).toEqual(['/dashboard', '/billing', '/docs', '/help', '/settings'])
  })

  it('places Admin before Settings when enabled', () => {
    render(
      <TooltipProvider>
        <SidebarNav compact showAdmin />
      </TooltipProvider>
    )

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links.at(-1)).toBe('/settings')
    expect(links).toContain('/admin')
    expect(links.indexOf('/admin')).toBeLessThan(links.indexOf('/settings'))
  })
})
