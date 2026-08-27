// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarNav } from '@/components/layout/sidebar'

const push = vi.fn()
const refresh = vi.fn()
const signOut = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: (...args: unknown[]) => signOut(...args),
  },
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

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
    reportTier: 'paid',
    canSharePublicly: true,
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
    signOut.mockResolvedValue(undefined)

    render(
      <MeProvider initialUser={user}>
        <AvatarMenu user={user} />
      </MeProvider>
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(await screen.findByRole('menuitem', { name: 'Products' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings'
    )
    expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/help')

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
      expect(push).toHaveBeenCalledWith('/')
      expect(refresh).toHaveBeenCalled()
    })
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
