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
      'No score history available'
    )
  })

  it('renders a single bar for one observation', () => {
    render(<ScoreHistoryChart history={[makePoint('a1', 65)]} />)
    const bars = screen.getAllByRole("button")
    expect(bars).toHaveLength(1)
    expect(bars[0]).toHaveAttribute('aria-label', expect.stringContaining('score 65'))
  })

  it('renders multiple bars for multiple observations', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 60, 'product-review', 'completed', 7),
          makePoint('a2', 65, 'update-review', 'completed', 3),
          makePoint('a3', 70, 'watch', 'completed', 0),
        ]}
      />
    )
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it('renders hollow bar with dot for no-score observation', () => {
    render(
      <ScoreHistoryChart history={[makePoint('a1', null, 'product-review', 'partial', 0)]} />
    )
    const bar = screen.getByRole("button")
    expect(bar).toHaveAttribute('aria-label', expect.stringContaining('Partial capture'))
    const visualBar = bar.querySelector('.bar')
    expect(visualBar).toHaveClass('barNoScore')
  })

  it('renders green bar for score 100', () => {
    render(<ScoreHistoryChart history={[makePoint('a1', 100, 'product-review', 'completed', 0)]} />)
    const bar = screen.getByRole("button")
    expect(bar).toHaveAttribute('aria-label', expect.stringContaining('score 100'))
    const visualBar = bar.querySelector('.bar')
    expect(visualBar).toHaveStyle({ backgroundColor: '#22C55E' })
  })

  it('shows score chip for scored bars', () => {
    render(<ScoreHistoryChart history={[makePoint('a1', 65)]} />)
    const chip = screen.getByText('65')
    expect(chip).toBeInTheDocument()
  })

  it('shows date label for a single observation', () => {
    const history = [makePoint('a1', 65, 'product-review', 'completed', 0)]
    render(<ScoreHistoryChart history={history} />)
    const dateLabel = screen.getByText(/Jul 28/i)
    expect(dateLabel).toBeInTheDocument()
  })

  it('shows first and last date labels for multiple observations', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 14),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} />)
    expect(screen.getAllByText(/Jul 14/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Jul 28/i).length).toBeGreaterThan(0)
  })

  it('calls onSelect when bar is clicked', () => {
    const onSelect = vi.fn()
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} onSelect={onSelect} />)
    const bars = screen.getAllByRole("button")
    fireEvent.click(bars[1])
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
    const bars = screen.getAllByRole("button")
    fireEvent.keyDown(bars[1], { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith(2)
    fireEvent.keyDown(bars[1], { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith(0)
    fireEvent.keyDown(bars[1], { key: 'Home' })
    expect(onSelect).toHaveBeenCalledWith(0)
    fireEvent.keyDown(bars[1], { key: 'End' })
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('renders loading indeterminate bar when isLoading is true', () => {
    const history = [makePoint('a1', 65, 'product-review', 'completed', 0)]
    render(<ScoreHistoryChart history={history} isLoading />)
    expect(screen.getAllByRole("button")).toHaveLength(1) // history bar; the live bar is a separate image
    expect(
      screen.getByRole("img", { name: "Live scan in progress" })
    ).toBeInTheDocument()
  })

  it('renders kind labels correctly in aria-label', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 3),
      makePoint('a3', 70, 'watch', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} />)
    const bars = screen.getAllByRole("button")
    expect(bars[0]).toHaveAttribute('aria-label', expect.stringContaining('Product review'))
    expect(bars[1]).toHaveAttribute('aria-label', expect.stringContaining('Update review'))
    expect(bars[2]).toHaveAttribute('aria-label', expect.stringContaining('Watch run'))
  })

  it('handles boundary scores at 0 and 99', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 0, 'product-review', 'completed', 2),
          makePoint('a2', 99, 'update-review', 'completed', 0),
        ]}
      />
    )
    const bars = screen.getAllByRole("button")
    expect(bars[0]).toHaveAttribute('aria-label', expect.stringContaining('score 0'))
    expect(bars[1]).toHaveAttribute('aria-label', expect.stringContaining('score 99'))
  })

  it('handles all-same scores without error', () => {
    render(
      <ScoreHistoryChart
        history={[
          makePoint('a1', 70, 'product-review', 'completed', 5),
          makePoint('a2', 70, 'update-review', 'completed', 3),
          makePoint('a3', 70, 'watch', 'completed', 0),
        ]}
      />
    )
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it('shows aria-current on selected bar only', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} selectedIndex={1} />)
    const bars = screen.getAllByRole("button")
    expect(bars[1]).toHaveAttribute('aria-current', 'true')
    expect(bars[0]).not.toHaveAttribute('aria-current')
  })

  it('shows screen reader announcement on selection', () => {
    const history = [
      makePoint('a1', 60, 'product-review', 'completed', 7),
      makePoint('a2', 65, 'update-review', 'completed', 0),
    ]
    render(<ScoreHistoryChart history={history} selectedIndex={1} />)
    const srOnly = screen.getByRole('status')
    expect(srOnly).toHaveTextContent(/Update review/)
    expect(srOnly).toHaveTextContent(/score 65/)
  })
})
