import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FlagResolutionPanel } from '@/components/sites/FlagResolutionPanel'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { flagResolutionView, siteFlagDetailStatus } from '@/lib/sites/flag-resolution'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/sites/p_example/flags/flag-1',
}))

const PROOF_AT = '2026-09-20T17:58:10.414Z'

function panel(status: string, proof: { id: string; status: string; completedAt: string | null; createdAt: string | null } | null, verifying = false) {
  const resolution = flagResolutionView({
    status,
    resolvedInId: proof?.id ?? 'audit-proof',
    sourceAuditId: 'audit-source',
    verifying,
    proof,
  })
  return render(
    <FlagResolutionPanel
      resolution={resolution}
      siteId="p_example"
      flagId="flag-1"
    >
      <p>Evidence stayed on the page.</p>
    </FlagResolutionPanel>,
  )
}

describe('Flag resolution panel', () => {
  it('shows Recovered for the improvement status the detail page loads', () => {
    for (const improvementStatus of ['PROPOSED', 'VERIFIED']) {
      const view = panel(siteFlagDetailStatus(improvementStatus, 'FIXED'), {
        id: 'audit-proof',
        status: 'COMPLETED',
        completedAt: PROOF_AT,
        createdAt: PROOF_AT,
      })
      expect(screen.getByText(SITE_BOARD_COPY.flagRecovered, { selector: 'p' })).toBeVisible()
      expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.flagRecovered })).toBeVisible()
      expect(screen.getByText(SITE_BOARD_COPY.flagProofObserved, { exact: false })).toBeVisible()
      expect(screen.queryByText(SITE_BOARD_COPY.flagStatus)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.verifyFix })).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('shows a recovered Flag as a dated check when the flag row itself is FIXED', () => {
    panel('FIXED', {
      id: 'audit-proof',
      status: 'COMPLETED',
      completedAt: PROOF_AT,
      createdAt: PROOF_AT,
    })
    expect(screen.getByText(SITE_BOARD_COPY.flagRecovered, { selector: 'p' })).toBeVisible()
    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.flagRecovered })).toBeVisible()
    expect(screen.getByText(SITE_BOARD_COPY.flagProofLead, { exact: false })).toBeVisible()
    expect(screen.getByText(SITE_BOARD_COPY.flagProofObserved, { exact: false })).toBeVisible()
    expect(screen.getByText('Proof audit: audit-proof')).toBeVisible()
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(PROOF_AT)
    expect(screen.queryByText(SITE_BOARD_COPY.flagStatus)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.verifyFix })).not.toBeInTheDocument()
  })

  it('shows a missing proof as unverified and offers Verify', () => {
    panel(siteFlagDetailStatus('PROPOSED', 'FIXED'), null)
    expect(screen.getAllByText(SITE_BOARD_COPY.flagProofMissing).length).toBeGreaterThan(0)
    expect(screen.getByText(SITE_BOARD_COPY.flagProofMissingBody)).toBeVisible()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix })).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.flagRecovered)).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.flagStatus)).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.verifying)).not.toBeInTheDocument()
  })

  it('shows Recovered when a verified Flag cites its completed improved attempt', () => {
    const resolution = flagResolutionView({
      status: siteFlagDetailStatus('VERIFIED', 'OPEN'),
      resolvedInId: null,
      attemptProofId: 'audit-proof',
      sourceAuditId: 'audit-source',
      verifying: false,
      proof: {
        id: 'audit-proof',
        status: 'COMPLETED',
        completedAt: PROOF_AT,
        createdAt: PROOF_AT,
      },
    })
    const view = render(
      <FlagResolutionPanel
        resolution={resolution}
        siteId="p_example"
        flagId="flag-1"
      >
        <p>Evidence stayed on the page.</p>
      </FlagResolutionPanel>,
    )
    expect(screen.getByText(SITE_BOARD_COPY.flagRecovered, { selector: 'p' })).toBeVisible()
    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.flagRecovered })).toBeVisible()
    expect(screen.getByText(SITE_BOARD_COPY.flagProofObserved, { exact: false })).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.flagStatus)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.verifyFix })).not.toBeInTheDocument()
    view.unmount()
  })

  it('offers Verify when a verified Flag cannot show its improved attempt', () => {
    const resolution = flagResolutionView({
      status: 'VERIFIED',
      resolvedInId: null,
      attemptProofId: 'audit-missing',
      sourceAuditId: 'audit-source',
      verifying: false,
      proof: null,
    })
    render(
      <FlagResolutionPanel
        resolution={resolution}
        siteId="p_example"
        flagId="flag-1"
      />,
    )
    expect(screen.getAllByText(SITE_BOARD_COPY.flagProofMissing).length).toBeGreaterThan(0)
    expect(screen.getByText(SITE_BOARD_COPY.flagProofMissingBody)).toBeVisible()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix })).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.flagRecovered)).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.flagStatus)).not.toBeInTheDocument()
  })

  it('shows an in-flight attempt as still running, with the last check labeled as history', () => {
    panel(siteFlagDetailStatus('VERIFIED', 'FIXED'), {
      id: 'audit-proof',
      status: 'COMPLETED',
      completedAt: PROOF_AT,
      createdAt: PROOF_AT,
    }, true)
    expect(screen.getByText(SITE_BOARD_COPY.verifying)).toBeVisible()
    expect(screen.getByText(SITE_BOARD_COPY.flagProofLastCheck)).toBeVisible()
    expect(screen.getByText(SITE_BOARD_COPY.flagProofRunning)).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.flagRecovered)).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.flagStatus)).not.toBeInTheDocument()
  })
})
