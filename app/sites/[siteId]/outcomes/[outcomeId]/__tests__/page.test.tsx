import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import OutcomeDetailPage from '../page'

const OBSERVED = '2026-09-23T22:57:11.000Z'

const mocks = vi.hoisted(() => ({
  requireSiteAccess: vi.fn(),
  loadSiteHome: vi.fn(),
  loadSiteOutcomeDetail: vi.fn(),
}))

vi.mock('@/lib/sites/request-access', () => ({
  requireSiteAccess: mocks.requireSiteAccess,
}))

vi.mock('@/lib/sites/application/queries', () => ({
  loadSiteHome: mocks.loadSiteHome,
}))

vi.mock('@/lib/sites/outcomes', () => ({
  loadSiteOutcomeDetail: mocks.loadSiteOutcomeDetail,
}))

vi.mock('@/components/sites/SiteShell', () => ({
  SiteShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function evidence(reason: string) {
  return {
    disposition: 'SUCCEEDED',
    reason,
    detail: null,
    createdAt: OBSERVED,
    auditId: 'audit-1',
  }
}

describe('Outcome proof card', () => {
  beforeEach(() => {
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'viewer', site: { siteId: 'site-1' } },
    })
    mocks.loadSiteHome.mockResolvedValue({
      site: { siteId: 'site-1' },
      flags: [],
      resolvedFlags: [],
      watch: { state: 'off', label: 'Off' },
    })
    mocks.loadSiteOutcomeDetail.mockResolvedValue({
      id: 'outcome-1',
      name: 'This page loads',
      expectation: 'The page responds.',
      summary: 'FixFlags completed every required check for this Outcome.',
      enabled: true,
      running: false,
      state: 'CLEAR',
      kind: 'AVAILABILITY',
      environment: 'production',
      staleAfterMinutes: 11520,
      flagId: null,
      pageUrls: [],
      limitation: null,
      recoveryAction: null,
      lastVerifiedAt: OBSERVED,
      lastSuccessfulVerificationAt: OBSERVED,
      bindings: [
        {
          key: 'checkout-browser-v1',
          required: true,
          mechanism: 'BROWSER_JOURNEY',
          version: 1,
          latestEvidence: evidence('checkout_reached'),
          customerSentence: 'FixFlags independently reached checkout.',
        },
        {
          key: 'signup-safe-form-v1',
          required: true,
          mechanism: 'SAFE_FORM',
          version: 1,
          latestEvidence: evidence('protected_or_irreversible'),
          customerSentence: 'This flow is protected, so FixFlags did not submit it.',
        },
        {
          key: 'page-availability-v1',
          required: true,
          mechanism: 'HTTP_AVAILABILITY',
          version: 1,
          latestEvidence: evidence('available'),
          customerSentence: 'FixFlags completed every required check for this Outcome.',
        },
        {
          key: 'notes-v1',
          required: false,
          mechanism: 'CUSTOM_SIGNAL',
          version: 1,
          latestEvidence: null,
          customerSentence: 'This method has not produced evidence yet.',
        },
      ],
      timeline: [{
        id: 'event-1',
        type: 'assessment',
        at: OBSERVED,
        title: 'Clear',
        detail: 'FixFlags completed every required check for this Outcome.',
        auditId: 'audit-1',
      }],
    })
  })

  it('names each method in customer words and uses the shared UTC evidence clock', async () => {
    const clock = formatEvidenceTimestamp(OBSERVED)
    render(await OutcomeDetailPage({
      params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }),
    }))

    expect(screen.getByText('Purchase path')).toBeVisible()
    expect(screen.getByText('Form')).toBeVisible()
    expect(screen.getByText('Page availability')).toBeVisible()
    expect(screen.getByText('Check')).toBeVisible()
    expect(screen.getAllByText(clock!, { exact: false }).length).toBeGreaterThanOrEqual(6)
    expect(screen.queryByText('Http availability')).not.toBeInTheDocument()
    expect(screen.queryByText('Browser journey')).not.toBeInTheDocument()
    expect(screen.queryByText('Safe form')).not.toBeInTheDocument()
    expect(screen.queryByText('Custom signal')).not.toBeInTheDocument()
  })
})
