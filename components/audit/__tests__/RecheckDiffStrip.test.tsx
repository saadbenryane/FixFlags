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
  it('describes raw absence without claiming the Flag was fixed or verified', () => {
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

    expect(screen.getAllByText('1 Flag no longer observed')).toHaveLength(2)
    expect(screen.queryByText(/Flag fixed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument()
  })

  it('keeps incomplete comparison coverage visible as inconclusive', () => {
    render(
      <RecheckDiffStrip
        summary={{
          fixed: [],
          inconclusive: [flag],
          unchanged: [],
          regressed: [],
          newIssues: [],
        }}
      />,
    )

    expect(screen.getAllByText('Inconclusive').length).toBeGreaterThan(0)
    expect(screen.getByText(/insufficient comparable coverage/i)).toBeInTheDocument()
  })
})
