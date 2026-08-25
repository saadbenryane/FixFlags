import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportFixLoop } from '@/components/report/ReportFixLoop'
import { REPORT_COPY } from '@/lib/marketing/copy'

describe('ReportFixLoop empty / loading states', () => {
  it('shows the no-flags copy when the list is empty and not loading', () => {
    render(<ReportFixLoop flags={[]} loading={false} />)
    expect(screen.getByText(REPORT_COPY.explorer.noFlagsNice)).toBeInTheDocument()
  })

  it('shows checking copy while loading with no flags yet', () => {
    render(<ReportFixLoop flags={[]} loading />)
    expect(screen.getByText(REPORT_COPY.explorer.checkingIssues)).toBeInTheDocument()
  })

  it('exposes selected semantics and the controlled detail relationship', () => {
    render(
      <ReportFixLoop
        selectedFlagId="flag-1"
        onSelectFlag={() => undefined}
        flags={[
          {
            id: 'flag-1',
            title: 'Clarify the primary action',
            rubric: 'MESSAGE',
            severity: 'IMPORTANT',
          },
        ]}
      />
    )

    const flag = screen.getByRole('button', {
      name: /Important Flag: Clarify the primary action/i,
    })
    expect(flag).toHaveAttribute('aria-pressed', 'true')
    expect(flag).toHaveAttribute('aria-controls', 'selected-flag-detail')
  })
  

  it('keeps the complete ranked Flag list visible', () => {
    render(
      <ReportFixLoop
        onSelectFlag={() => undefined}
        flags={[
          {
            id: 'flag-1',
            title: 'Clarify the primary action',
            rubric: 'MESSAGE',
            severity: 'IMPORTANT',
          },
          {
            id: 'flag-2',
            title: 'Missing Open Graph title',
            rubric: 'REACH',
            severity: 'NICE_TO_HAVE',
          },
        ]}
      />
    )

    expect(screen.getByText('Missing Open Graph title')).toBeInTheDocument()
    expect(screen.queryByText(REPORT_COPY.explorer.moreChecks)).not.toBeInTheDocument()
  })

})
