import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteMonitoringHistory } from '../SiteMonitoringHistory'

describe('monitoring evidence chart', () => {
  it('leaves a gap between complete checks when evidence is incomplete', () => {
    render(<SiteMonitoringHistory points={[
      { label: 'Oct 8', flagCount: 3 }, { label: 'Oct 9', flagCount: 2 },
      { label: 'Oct 10', flagCount: null },
      { label: 'Oct 11', flagCount: 1 }, { label: 'Oct 12', flagCount: 0 },
    ]} events={[]} emptyMessage="No history" />)
    const chart = screen.getByRole('img', { name: 'Flag count across 5 checks' })
    expect(chart).toHaveAccessibleDescription('Oct 8: 3 Flags; Oct 9: 2 Flags; Oct 10: Check incomplete; Oct 11: 1 Flag; Oct 12: 0 Flags')
    const lines = [...chart.querySelectorAll('polyline')]
    expect(lines).toHaveLength(2)
    expect(lines.every(line => line.getAttribute('points')?.split(' ').length === 2)).toBe(true)
    expect(chart.querySelectorAll('polygon')).toHaveLength(2)
    expect(screen.getByText('Incomplete checks leave a gap. They do not count as zero Flags.')).toBeVisible()
  })

  it('reports an incomplete latest check without replacing it with zero', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 11', flagCount: 2 }, { label: 'Oct 12', flagCount: null }]} events={[]} emptyMessage="No history" />)
    expect(screen.getByText('Check incomplete')).toBeVisible()
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleDescription('Oct 11: 2 Flags; Oct 12: Check incomplete')
  })

  it('shows one completed observation and preserves timeline evidence links', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 12', flagCount: 1 }]} events={[
      { id: 'one', title: 'Check completed', time: 'Oct 12', dateTime: '2026-10-12T09:00:00Z', state: 'attention', flagCount: 1, flags: [{ id: 'flag-1', title: 'Pricing page failed', href: '/sites/site-1/flags/flag-1' }] },
    ]} emptyMessage="No history" />)
    expect(screen.getByRole('img', { name: 'Flag count across 1 check' })).toBeVisible()
    const timeline = screen.getByRole('list', { name: 'Check history' })
    expect(within(timeline).getByRole('link', { name: 'Pricing page failed' })).toHaveAttribute('href', '/sites/site-1/flags/flag-1')
  })

  it('shows the empty state only when neither history nor events exist', () => {
    render(<SiteMonitoringHistory points={[]} events={[]} emptyMessage="No history" />)
    expect(screen.getByText('No history')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
