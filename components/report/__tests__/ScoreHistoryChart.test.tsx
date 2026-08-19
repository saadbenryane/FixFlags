import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'

function makePoint(
  id: string,
  score: number | null,
  kind: ReportWorkspaceHistoryPoint['kind'] = 'product-review',
  status: ReportWorkspaceHistoryPoint['status'] = 'completed',
  daysAgo = 0
): ReportWorkspaceHistoryPoint {
  const d = new Date('2026-07-28T10:00:00Z')
  d.setDate(d.getDate() - daysAgo)
  return { id, score, checkedAt: d, kind, status }
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

  it('renders one bar per observation', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 60, 'product-review', 'completed', 7),
          makePoint('a2', 65, 'update-review', 'completed', 3),
          makePoint('a3', 70, 'watch', 'completed', 0),
        ]}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('includes score in aria-label', () => {
    render(<ScoreHistoryChart history={[makePoint('a1', 65)]} />)
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('score 65'),
    )
  })

  it('includes kind label in aria-label', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 3),
      makePoint('a3', 70, 'watch', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} />)
    const bars = screen.getAllByRole('button')
    expect(bars[0]).toHaveAttribute('aria-label', expect.stringContaining('Product review'))
    expect(bars[1]).toHaveAttribute('aria-label', expect.stringContaining('Update review'))
    expect(bars[2]).toHaveAttribute('aria-label', expect.stringContaining('Watch run'))
  })

  it('calls onSelect when bar is clicked', () => {
    const onSelect = vi.fn()
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('supports keyboard navigation with arrow keys', () => {
    const onSelect = vi.fn()
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 3),
      makePoint('a3', 70, 'watch', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} onSelect={onSelect} selectedIndex={1} />)
    const bars = screen.getAllByRole('button')
    fireEvent.keyDown(bars[1], { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith(2)
    fireEvent.keyDown(bars[1], { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith(0)
    fireEvent.keyDown(bars[1], { key: 'Home' })
    expect(onSelect).toHaveBeenCalledWith(0)
    fireEvent.keyDown(bars[1], { key: 'End' })
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('shows aria-current on selected bar only', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} selectedIndex={1} />)
    const bars = screen.getAllByRole('button')
    expect(bars[1]).toHaveAttribute('aria-current', 'true')
    expect(bars[0]).not.toHaveAttribute('aria-current')
  })

  it('shows screen reader announcement on selection', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} selectedIndex={1} />)
    const srOnly = screen.getByRole('status', { hidden: true })
    expect(srOnly).toHaveTextContent(/Update review/)
    expect(srOnly).toHaveTextContent(/score 65/)
  })

  it('shows loading bar when isLoading is true', () => {
    const history = [makePoint('a1', 65, 'product-review', 'completed', 0)]
    render(<ScoreHistoryChart history={history} isLoading />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Live scan in progress' })).toBeInTheDocument()
  })

  it('handles no-score observations with reduced opacity bar', () => {
    render(
      <ScoreHistoryChart history={[makePoint('a1', null, 'product-review', 'partial', 0)]} />,
    )
    const bar = screen.getByRole('button')
    expect(bar).toHaveAttribute('aria-label', expect.stringContaining('Partial capture'))
  })
})
