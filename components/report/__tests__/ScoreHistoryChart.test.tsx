import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'

function makePoint(
  id: string,
  score: number | null,
  kind: ReportWorkspaceHistoryPoint['kind'] = 'product-review',
  status: ReportWorkspaceHistoryPoint['status'] = 'completed',
  daysAgo = 0,
): ReportWorkspaceHistoryPoint {
  const checkedAt = new Date('2026-07-28T10:00:00Z')
  checkedAt.setUTCDate(checkedAt.getUTCDate() - daysAgo)
  return {
    id,
    href: `/report/${id}?view=report`,
    score,
    checkedAt,
    kind,
    status,
  }
}

describe('ScoreHistoryChart', () => {
  it('renders an honest empty state for empty history', () => {
    render(<ScoreHistoryChart history={[]} />)
    expect(screen.getByText('No observations yet')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'No score history available',
    )
  })

  it('renders one native destination link per Review', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 3),
      makePoint('a3', 70, 'watch', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      history.map((point) => point.href),
    )
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('gives every link an ordinal, kind, date, status, and rounded score', () => {
    const history = [
      makePoint('a1', 60.4, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'partial', 3),
      makePoint('a3', 70, 'watch', 'degraded', 0),
    ]
    render(<ScoreHistoryChart history={history} />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName(
      'Review 1 of 3, Product review, Jul 21, 2026, Completed, score 60',
    )
    expect(links[1]).toHaveAccessibleName(
      'Review 2 of 3, Recheck, Jul 25, 2026, Partial capture, score 65',
    )
    expect(links[2]).toHaveAccessibleName(
      'Review 3 of 3, Watch run, Jul 28, 2026, Degraded capture, score 70',
    )
  })

  it('marks only the current audit link as the current page', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} currentAuditId="a2" />)

    const links = screen.getAllByRole('link')
    expect(links[1]).toHaveAttribute('aria-current', 'page')
    expect(links[0]).not.toHaveAttribute('aria-current')
  })

  it('provides a 44px target around each dense visual bar', () => {
    render(<ScoreHistoryChart history={[makePoint('a1', 65)]} />)
    expect(screen.getByRole('link')).toHaveClass('min-h-11', 'min-w-11')
  })

  it('announces a live Review without fabricating a history destination', () => {
    render(
      <ScoreHistoryChart
        history={[makePoint('a1', 65, 'product-review', 'completed', 0)]}
        isLoading
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Live review in progress')
  })

  it('describes no-score Reviews with their honest status', () => {
    render(
      <ScoreHistoryChart
        history={[makePoint('a1', null, 'product-review', 'failed', 0)]}
      />,
    )
    expect(screen.getByRole('link')).toHaveAccessibleName(
      expect.stringMatching(/Failed capture, score unavailable/),
    )
  })
})
