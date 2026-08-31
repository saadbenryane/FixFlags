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
  it('renders compact count cards for non-empty buckets', () => {
    render(
      <RecheckDiffStrip
        summary={{
          fixed: [flag],
          inconclusive: [flag],
          unchanged: [flag, flag],
          regressed: [],
          newIssues: [flag],
        }}
      />,
    )

    expect(screen.getByText('Fixed')).toBeInTheDocument()
    expect(screen.getByText('Still open')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Inconclusive')).toBeInTheDocument()
    expect(screen.queryByText('Regressed')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What Fixed means/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What New means/i })).toBeInTheDocument()
  })

  it('hides empty buckets and never shows a yellow inconclusive hero', () => {
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

    expect(screen.getByText('Inconclusive')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /inconclusive/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
