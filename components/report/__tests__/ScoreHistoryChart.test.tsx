import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'

function makePoint(id: string, score: number, daysAgo = 0): { id: string; score: number; checkedAt: Date } {
  const d = new Date('2026-07-28T10:00:00Z')
  d.setDate(d.getDate() - daysAgo)
  return { id, score, checkedAt: d }
}

describe('ScoreHistoryChart', () => {
  it('returns null for empty history', () => {
    const { container } = render(<ScoreHistoryChart history={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders an SVG for a single point', () => {
    render(<ScoreHistoryChart history={[makePoint('a1', 65)]} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Release score over 1 scans: 65')
  })

  it('renders an SVG for multiple points with correct aria-label', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 60, 7),
          makePoint('a2', 65, 3),
          makePoint('a3', 70, 0),
        ]}
      />
    )
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Release score over 3 scans: 60, 65, 70'
    )
  })

  it('renders date labels for first and last points', () => {
    // Labels moved out of the SVG into crisp HTML (bdf82dcf), so assert the
    // rendered text rather than SVG <text> nodes.
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const history = [makePoint('a1', 60, 14), makePoint('a2', 65, 0)]
    render(<ScoreHistoryChart history={history} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(
      screen.getByText(formatter.format(history[0].checkedAt))
    ).toBeInTheDocument()
    expect(
      screen.getByText(formatter.format(history[1].checkedAt))
    ).toBeInTheDocument()
  })

  it('handles all-same scores without error', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 70, 5),
          makePoint('a2', 70, 3),
          makePoint('a3', 70, 0),
        ]}
      />
    )
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('handles boundary scores at 0 and 100', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 0, 2),
          makePoint('a2', 100, 0),
        ]}
      />
    )
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})
