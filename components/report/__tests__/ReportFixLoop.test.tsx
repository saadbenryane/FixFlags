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
})
