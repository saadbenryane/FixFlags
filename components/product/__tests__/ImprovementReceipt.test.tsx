import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ImprovementReceipt } from '@/components/product/ImprovementReceipt'
import type { ProductAttemptDTO } from '@/lib/products/workspace'

function attempt(outcome: ProductAttemptDTO['outcome']): ProductAttemptDTO {
  return {
    id: `attempt-${outcome ?? 'pending'}`,
    sourceReviewId: 'source-review',
    sourceFlagId: 'source-flag',
    builder: 'web',
    changeSummary: 'Moved the signup action into the first view.',
    deploymentReference: 'deploy-42',
    verificationReviewId: outcome ? 'verification-review' : null,
    outcome,
    testedCondition: outcome ? 'The signup action is visible.' : null,
    comparable: outcome ? outcome !== 'INCONCLUSIVE' : null,
    verificationCoverage: outcome
      ? {
          completeReview: true,
          evidenceComparable: outcome !== 'INCONCLUSIVE',
          relevantPageCovered: true,
          verifierExecuted: outcome !== 'INCONCLUSIVE',
          verifierStatus: outcome === 'INCONCLUSIVE' ? 'MISSING' : 'COMPLETED',
          failedModules: outcome === 'INCONCLUSIVE' ? ['mobile-capture'] : [],
          pageUrl: 'https://example.com/signup',
        }
      : null,
    verificationReason:
      outcome === 'INCONCLUSIVE'
        ? 'The update Review did not capture comparable evidence.'
        : outcome
          ? 'The fresh update Review completed comparable verification coverage.'
          : null,
    evidenceReference: outcome
      ? {
          beforeAuditId: 'source-review',
          beforeFlagId: 'source-flag',
          afterAuditId: 'verification-review',
          afterFlagId: outcome === 'IMPROVED' ? null : 'after-flag',
        }
      : null,
    remainingRisk:
      outcome === 'INCONCLUSIVE'
        ? 'Comparable mobile evidence is unavailable.'
        : null,
    createdAt: '2026-08-13T12:00:00.000Z',
  }
}

describe('ImprovementReceipt', () => {
  for (const outcome of ['IMPROVED', 'UNCHANGED', 'REGRESSED'] as const) {
    it(`renders the ${outcome} evidence receipt with exact provenance`, () => {
      render(<ImprovementReceipt attempt={attempt(outcome)} />)

      expect(
        screen.getByText(outcome.charAt(0) + outcome.slice(1).toLowerCase()),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: /open source evidence/i }),
      ).toHaveAttribute(
        'href',
        '/report/source-review?view=report&flag=source-flag#report-flags',
      )
      expect(
        screen.getByRole('link', { name: /open verification review/i }),
      ).toHaveAttribute('href', '/report/verification-review?view=report')
      expect(screen.getByText('Verifier completed: Yes')).toBeInTheDocument()
    })
  }

  it('renders INCONCLUSIVE as missing evidence rather than success', () => {
    render(<ImprovementReceipt attempt={attempt('INCONCLUSIVE')} />)

    expect(screen.getByText('Inconclusive')).toBeInTheDocument()
    expect(screen.getByText('Comparable evidence: No')).toBeInTheDocument()
    expect(screen.getByText('Verifier completed: No')).toBeInTheDocument()
    expect(
      screen.getByText(/Unavailable evidence: mobile-capture/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Comparable mobile evidence is unavailable.'),
    ).toBeInTheDocument()
  })

  it('keeps a builder declaration explicitly pending until an update Review', () => {
    render(<ImprovementReceipt attempt={attempt(null)} />)

    expect(screen.getByText('Awaiting update review')).toBeInTheDocument()
    expect(
      screen.getByText(/builder declaration is not verification/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /open verification review/i }),
    ).not.toBeInTheDocument()
  })
})
