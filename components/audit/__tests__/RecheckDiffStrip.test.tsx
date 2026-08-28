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
  it('summarizes Fixed absences without claiming verification', () => {
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

    expect(screen.getByText(/1 Fixed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What Fixed means/i })).toBeInTheDocument()
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument()
  })

  it('names PARTIAL capture when inconclusive Flags cannot be credited as Fixed', () => {
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

    expect(screen.getByText(/not fully re-checked/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot credit Fixed/i)).toBeInTheDocument()
  })
})
