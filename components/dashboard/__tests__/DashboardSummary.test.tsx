import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardSummary } from '@/components/dashboard/DashboardSummary'

describe('DashboardSummary', () => {
  it('links the latest readiness card to the completed report', () => {
    render(
      <DashboardSummary
        latestScore={78}
        latestReportId="report-123"
        criticalFlags={1}
        importantFlags={5}
        trendScores={[78]}
      />
    )

    expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute(
      'href',
      '/report/report-123'
    )
  })

  it('shows a useful first-check state without a dead report action', () => {
    render(
      <DashboardSummary
        latestScore={null}
        latestReportId={null}
        criticalFlags={0}
        importantFlags={0}
        trendScores={[]}
      />
    )

    expect(screen.getByText('No completed check yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open report' })).not.toBeInTheDocument()
  })
})
