import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteBoard } from '../SiteBoard'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { CARE_HOME } from '@/lib/marketing/copy'

const SITE_PATH = '/sites/p_example'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => SITE_PATH,
}))

const signedInUser = {
  id: 'u1',
  email: 'owner@example.com',
  plan: 'FREE',
} as MeUser

function boardView(overrides: Partial<SiteHomeView> = {}): SiteHomeView {
  return {
    site: {
      siteId: 'p_example',
      kind: 'provisional',
      url: 'https://example.com',
      canonicalHost: 'example.com',
      name: 'example.com',
      projectId: null,
      provisionalSiteId: 'example',
      primaryAuditId: 'audit-1',
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId: null,
    },
    host: 'example.com',
    statusLabel: '1 Flag',
    statusState: 'attention',
    audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, score: 80 },
    cards: [],
    flags: [],
    recommendations: [],
    outcomes: [],
    watching: false,
    watch: {
      state: 'off',
      interval: null,
      nextRunAt: null,
      lastError: null,
      covered: false,
      label: 'Not watching',
    },
    coverageSummary: 'Checked recently · 0 open Flags',
    ...overrides,
  }
}

function renderBoard(user: MeUser | null) {
  return render(
    <MeProvider initialUser={user}>
      <SiteBoard siteId="p_example" initial={boardView()} />
    </MeProvider>
  )
}

describe('SiteBoard chrome', () => {
  it('shows Sign in with a next path for logged-out visitors', () => {
    renderBoard(null)
    const links = screen.getAllByRole('link', { name: CARE_HOME.signIn })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `/sign-in?next=${encodeURIComponent(SITE_PATH)}`
      )
      expect(link).toHaveClass('bg-brand', 'text-brand-foreground')
    }
    expect(screen.queryByRole('link', { name: 'All Sites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep watching' })).not.toBeInTheDocument()
    expect(screen.queryByText('Not watching')).not.toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Site' })
    expect(rail).toBeInTheDocument()
    expect(rail).toHaveTextContent('Home')
    expect(rail).toHaveTextContent('Flags')
    expect(rail).toHaveTextContent('Settings')
    expect(rail).not.toHaveTextContent('Not watching')
    expect(rail).not.toHaveTextContent('Keep watching')
    expect(rail).not.toHaveTextContent('All Sites')
  })

  it('keeps watch and All Sites for signed-in owners', () => {
    renderBoard(signedInUser)
    expect(screen.queryByRole('link', { name: CARE_HOME.signIn })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'All Sites' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Keep watching' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Not watching')).toBeInTheDocument()
  })
})
