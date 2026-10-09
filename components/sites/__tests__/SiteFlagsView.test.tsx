import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteFlagsView, siteFlagTab } from '../SiteFlagsView'
import { SiteBoard } from '../SiteBoard'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/sites/p_example/flags',
}))

const signedInUser = { id: 'u1', email: 'owner@example.com', plan: 'FREE' } as MeUser

function renderFlags(tab: 'open' | 'resolved', view: SiteHomeView = flagsView()) {
  return render(
    <MeProvider initialUser={signedInUser}>
      <SiteFlagsView siteId="p_example" view={view} tab={tab} />
    </MeProvider>
  )
}

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

/** Comments explain the boundary. They must not satisfy or defeat the guard. */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function flag(overrides: Partial<SiteFlagSeed> & Pick<SiteFlagSeed, 'id' | 'problem'>): SiteFlagSeed {
  return {
    sourceFlagId: overrides.id,
    confidence: null,
    improvementId: null,
    checkId: 'meta-description-missing',
    rubric: 'REACH',
    severity: 'IMPORTANT',
    impactTag: 'SEO',
    evidence: 'The page has no meta description.',
    whyItMatters: 'Search results have less to show.',
    fix: 'Add a meta description.',
    pageUrl: 'https://example.com/',
    status: 'OPEN',
    area: 'search',
    affectedPaths: ['https://example.com/'],
    affectedPageCount: 1,
    priorityBand: 'other',
    priorityScore: 55,
    relatedOutcome: null,
    verificationState: 'unverified',
    latestOccurrenceAt: null,
    ...overrides,
  }
}

function flagsView(overrides: Partial<SiteHomeView> = {}): SiteHomeView {
  const base: SiteHomeView = {
    site: {
      siteId: 'p_example',
      kind: 'provisional',
      url: 'https://example.com',
      canonicalHost: 'example.com',
      name: 'example.com',
      projectId: 'proj-1',
      provisionalSiteId: null,
      primaryAuditId: 'audit-1',
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId: 'u1',
    },
    presentation: {
      identity: { siteId: 'p_example', name: 'example.com', host: 'example.com', preview: null },
      result: { state: 'flags', label: 'Flags found' },
      monitoring: { state: 'not_monitored', label: 'Not monitored' },
      coverage: { pagesReached: 1, pagesExpected: 1, label: '1 page', complete: true },
      freshness: { checkedAt: null, stale: false, label: 'No completed analysis' },
      flags: { count: 1, label: '1 Flag', fixFirstCount: 0 },
      run: { state: 'idle', label: 'Run details', auditId: 'audit-1', recoveryAction: null },
      categories: [],
    },
    audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: true, failureCode: null },
    cards: [],
    flags: [flag({ id: 'f-open', problem: 'Meta description is missing' })],
    recommendations: [],
    resolvedFlags: [flag({ id: 'f-fixed', problem: 'Alt text was missing', status: 'FIXED' })],
    outcomes: [],
    watch: {
      state: 'off',
      interval: null,
      nextRunAt: null,
      lastRunAt: null,
      lastError: null,
      covered: false,
      label: 'Not watching',
      alert: { state: 'none', status: null, attempts: 0, at: null },
    },
    settings: {
      notificationLevel: 'FLAGS', notifyOnRecovery: true,
      shopify: { configured: true, state: 'not_connected', domain: null },
      searchConsole: { provider: 'SEARCH_CONSOLE', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
      analytics: { provider: 'ANALYTICS', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
    },
  }
  return { ...base, ...overrides, presentation: { ...base.presentation, ...overrides.presentation } }
}

/**
 * `89ed9cdb` shipped a Flags tab that called `useSearchParams` from a Server
 * Component. Every unit test passed and only `next build` failed, because
 * rendering the component in jsdom says nothing about the client boundary.
 * These two tests read the source, so the boundary is checked where the bug
 * actually lives.
 */
describe('the Flags view stays a Server Component', () => {
  it('never calls useSearchParams, which only works in a Client Component', () => {
    expect(code('components/sites/SiteFlagsView.tsx')).not.toMatch(/useSearchParams/)
  })

  it('is not marked as a client component, matching the sibling Site settings view', () => {
    expect(source('components/sites/SiteFlagsView.tsx').trimStart().startsWith("'use client'")).toBe(false)
    expect(source('components/sites/SiteSettingsView.tsx').trimStart().startsWith("'use client'")).toBe(false)
  })
})

describe('the tab is read on the server', () => {
  it('accepts the two real tabs', () => {
    expect(siteFlagTab('open')).toBe('open')
    expect(siteFlagTab('resolved')).toBe('resolved')
  })

  it('falls back to Open attention for a missing, repeated or unknown tab', () => {
    // A mangled URL must still show the Flags that need a fix, not a blank page.
    expect(siteFlagTab(undefined)).toBe('open')
    expect(siteFlagTab('Resolved')).toBe('open')
    expect(siteFlagTab('history')).toBe('open')
    expect(siteFlagTab(['open', 'resolved'])).toBe('open')
  })

  it('reaches both tabs as real links the customer can open', () => {
    renderFlags('open')
    const open = screen.getByRole('tab', { name: /open \(1\)/i })
    const resolved = screen.getByRole('tab', { name: /resolved/i })
    expect(open).toHaveAttribute('aria-selected', 'true')
    expect(resolved).toHaveAttribute('href', '/sites/p_example/flags?tab=resolved')
    open.focus()
    fireEvent.keyDown(open, { key: 'ArrowRight' })
    expect(resolved).toHaveFocus()
    expect(open).toHaveAttribute('aria-selected', 'true')
    expect(resolved).toHaveAttribute('aria-selected', 'false')
  })
})

/**
 * `89ed9cdb` added this because production held 47 Flags the product had
 * independently verified as fixed and no surface showed them. Resolved history
 * must be reachable without diluting the open attention a customer came for.
 */
describe('Open attention and Resolved are different lists', () => {
  it('shows an open Flag on the open tab', () => {
    renderFlags('open')
    expect(screen.getByText('Meta description is missing')).toBeVisible()
    expect(screen.queryByText('Alt text was missing')).not.toBeInTheDocument()
  })

  it('shows a verified recovery, with its proof, on the resolved tab', () => {
    renderFlags('resolved')
    expect(screen.getByText('Alt text was missing')).toBeVisible()
    expect(screen.queryByText('Meta description is missing')).not.toBeInTheDocument()
    expect(screen.getByText(SITE_BOARD_COPY.flagResolvedList)).toBeVisible()
    expect(screen.queryByText(/verified as fixed/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View proof' })).toHaveAttribute('href', expect.stringContaining('/flags/'))
    expect(screen.queryByRole('button', { name: /copy fix prompt/i })).not.toBeInTheDocument()
  })

  it('never implies a Site is healthy just because nothing is open', () => {
    renderFlags('open', flagsView({
      flags: [],
      presentation: {
        ...flagsView().presentation,
        result: { state: 'could_not_verify', label: 'Couldn’t verify' },
        flags: { count: 0, label: '0 Flags', fixFirstCount: 0 },
      },
    }))
    expect(screen.getByText('No Flags found. Coverage is incomplete.')).toBeVisible()
    expect(screen.queryByText('Nothing needs you right now.')).not.toBeInTheDocument()
  })

  it('says no verified recoveries yet without claiming the Site is healthy', () => {
    renderFlags('resolved', flagsView({ resolvedFlags: [] }))
    expect(screen.getByText('No verified recoveries yet')).toBeVisible()
  })
})

describe('resolved proof stays tenant-scoped and evidence-bound', () => {
  it('only accepts a completed proof audit from the same Site', () => {
    const page = code('app/sites/[siteId]/flags/[flagId]/page.tsx')
    expect(page).toMatch(/projectId:\s*site\.projectId/)
    expect(page).toMatch(/status:\s*'COMPLETED'/)
    expect(page).toContain('flagRecoveryProofId')
    expect(page).toContain('attempts: flag.attempts')
    expect(page).toContain('attemptProofId')
    expect(page).toContain('flagResolutionView')
    expect(page).toContain('FlagResolutionPanel')
    expect(page).not.toContain('The page no longer shows the problem.')
    expect(page).not.toContain('verified as fixed')
    const copy = code('lib/marketing/copy/terminology.ts')
    expect(copy).toContain('That check no longer found the problem.')
    const flags = code('lib/sites/flags.ts')
    expect(flags).toContain("status: 'VERIFIED'")
    expect(flags).toContain('comparable: true')
    expect(flags).toContain('verificationAuditId: { not: null }')
    expect(flags).toContain('selectResolvedFlags')
  })
})

describe('the Flags tab is reachable from the Site chrome', () => {
  it('is linked from the Site shell navigation', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={flagsView()} />
      </MeProvider>
    )
    const links = screen.getAllByRole('link', { name: /^Flags/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', '/sites/p_example/flags')
  })
})
