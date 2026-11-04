import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileSidebar } from '../sidebar'
import { ReportMobileNav } from '../ReportAppRail'

const state = vi.hoisted(() => ({ pathname: '/dashboard', gate: vi.fn(),
  user: { id: 'owner', email: 'owner@example.com', name: 'Owner', plan: 'FREE' } as { id: string; email: string; name: string; plan: string } | null }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: state.user }) }))
vi.mock('@/components/auth/ReportAuthGate', () => ({ useReportAuthGate: () => ({ open: state.gate }) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }))

beforeEach(() => {
  state.pathname = '/dashboard'
  state.user = { id: 'owner', email: 'owner@example.com', name: 'Owner', plan: 'FREE' }
  state.gate.mockClear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe.each([
  { name: 'account', Menu: MobileSidebar },
  { name: 'Site', Menu: ReportMobileNav },
])('$name mobile navigation', ({ Menu }) => {
  it.each(['FixFlags', 'Websites'])('closes after following the %s link, including on the current page', async label => {
    render(<Menu />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
    fireEvent.click(within(dialog).getByRole('link', { name: label }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
  })

  it('closes for a committed route change and stays closed on return', async () => {
    const view = render(<Menu />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByRole('dialog', { name: 'Navigation' })).toBeVisible()
    state.pathname = '/settings'
    view.rerender(<Menu />)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
    state.pathname = '/dashboard'
    view.rerender(<Menu />)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByRole('dialog', { name: 'Navigation' })).toBeVisible()
  })

  it.each(['ctrlKey', 'metaKey'])('keeps the menu open for a %s click without opening a sign-in gate', async modifier => {
    state.user = null
    render(<Menu />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
    fireEvent.click(within(dialog).getByRole('link', { name: 'Websites' }), { [modifier]: true })
    expect(state.gate).not.toHaveBeenCalled()
    expect(dialog).toBeVisible()
  })

  it('leaves the menu available when a navigation guard cancels the link', async () => {
    render(<Menu />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
    const stop = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation() }
    document.addEventListener('click', stop, true)
    try {
      fireEvent.click(within(dialog).getByRole('link', { name: 'Websites' }))
      expect(dialog).toBeVisible()
    } finally { document.removeEventListener('click', stop, true) }
  })
})

it('closes the account mobile menu after navigating from its account dropdown', async () => {
  render(<MobileSidebar />)
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  await screen.findByRole('dialog', { name: 'Navigation' })
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0, ctrlKey: false })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Account settings' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
})

it('closes the Site menu when an ordinary account link opens sign-in', async () => {
  state.user = null
  render(<ReportMobileNav />)
  const trigger = screen.getByRole('button', { name: 'Open menu' })
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
  const link = within(dialog).getByRole('link', { name: 'Websites' })
  fireEvent.click(link)
  expect(state.gate).toHaveBeenCalledExactlyOnceWith({ reason: 'create-account', nextPath: '/dashboard', trigger })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
})
