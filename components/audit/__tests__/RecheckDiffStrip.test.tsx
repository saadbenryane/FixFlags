import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecheckDiffStrip } from '@/components/audit/RecheckDiffStrip'

const flag = {
  checkId: 'cta-visible',
  problem: 'The primary action is below the fold.',
  rubric: 'EXPERIENCE',
  severity: 'IMPORTANT',
}

describe('RecheckDiffStrip', () => {
  it('summarizes absences without claiming the Flag was fixed or verified', () => {
    render(
      <RecheckDiffStrip
        summary={{
          fixed: [flag],
          inconclusive: [],
          unchanged: [],
          regressed: [],
          newIssues: [],
        }}
      />,
    )

    expect(screen.getByText(/1 no longer observed/i)).toBeInTheDocument()
    expect(screen.queryByText(/Flag fixed/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/Verification receipts show whether an attempted Improvement worked/i)
    ).toBeInTheDocument()
  })

  it('names PARTIAL capture when inconclusive Flags cannot be credited as clears', () => {
    render(
      <RecheckDiffStrip
        childPartial
        summary={{
          fixed: [],
          inconclusive: [flag],
          unchanged: [],
          regressed: [],
          newIssues: [],
        }}
      />,
    )

    expect(screen.getByText(/partial capture/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot credit clears/i)).toBeInTheDocument()
  })
})
