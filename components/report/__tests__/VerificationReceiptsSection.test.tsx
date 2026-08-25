import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerificationReceiptsSection } from '@/components/report/VerificationReceiptsSection'
import type { ProductAttemptDTO } from '@/lib/products/workspace'

const receipt: ProductAttemptDTO = {
  id: 'attempt-1',
  sourceReviewId: 'review-1',
  sourceFlagId: 'flag-1',
  builder: 'Cursor',
  changeSummary: 'Moved the primary action above the fold.',
  deploymentReference: 'deploy-1',
  verificationReviewId: 'review-2',
  outcome: 'IMPROVED',
  testedCondition: 'The primary action is visible on mobile and desktop.',
  comparable: true,
  verificationCoverage: {
    completeReview: true,
    evidenceComparable: true,
    relevantPageCovered: true,
    verifierExecuted: true,
  },
  verificationReason: 'The independent verifier confirmed the condition.',
  evidenceReference: null,
  remainingRisk: null,
  createdAt: '2026-08-25T10:00:00.000Z',
}

describe('VerificationReceiptsSection', () => {
  it('renders the durable receipt attached to the child update review', () => {
    render(<VerificationReceiptsSection receipts={[receipt]} />)

    expect(screen.getByRole('heading', { name: 'Independent verification' })).toBeInTheDocument()
    expect(screen.getByText('1 verification receipt')).toBeInTheDocument()
    expect(screen.getByText('Improved')).toBeInTheDocument()
    expect(screen.getByText(/independent verifier confirmed/i)).toBeInTheDocument()
  })

  it('does not create an empty verification surface', () => {
    const { container } = render(<VerificationReceiptsSection receipts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
