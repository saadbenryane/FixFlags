import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportWorkspace } from '@/components/report/ReportWorkspace'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'
import { MeProvider } from '@/hooks/useMe'

describe('ReportWorkspace', () => {
  it('renders the canonical outcome, summary, and complete curated Flag list', () => {
    const report = buildSampleReportDisplay(getStaticSampleAudit())
    const model = buildCuratedSampleWorkspaceModel(report)
    const criticalFlags = report.flags.filter(
      (flag) => flag.severity === 'CRITICAL'
    )

    render(
      <MeProvider initialUser={null}>
        <ReportWorkspace model={model} density="compact" />
      </MeProvider>
    )

    expect(screen.getByRole('heading', { name: 'Fix list' })).toBeInTheDocument()
    expect(screen.getByText('Critical Flags')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: `Show ${criticalFlags.length} Critical ${criticalFlags.length === 1 ? 'Flag' : 'Flags'}`,
      })
    ).toHaveAttribute('href', expect.stringContaining('severity=CRITICAL'))
    expect(screen.queryByText('Readiness')).not.toBeInTheDocument()
    expect(screen.queryByText('High-impact Flags')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs Attention')).not.toBeInTheDocument()
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument()
    expect(screen.getByRole('region', {
      name: `Fix list with ${report.flags.length} flags`,
    })).toBeInTheDocument()
    for (const flag of report.flags) {
      expect(screen.getAllByText(flag.title).length).toBeGreaterThan(0)
    }
  })

  it('shows a non-interactive zero when no Critical Flags remain', () => {
    const report = buildSampleReportDisplay(getStaticSampleAudit())
    const model = buildCuratedSampleWorkspaceModel(report)
    model.outcome.criticalCount = 0
    model.summary.rubrics.forEach((rubric) => {
      rubric.criticalCount = 0
    })
    model.explorer.flags.forEach((flag) => {
      if (flag.severity === 'CRITICAL') flag.severity = 'IMPORTANT'
    })

    render(
      <MeProvider initialUser={null}>
        <ReportWorkspace model={model} density="compact" />
      </MeProvider>
    )

    expect(screen.getByLabelText('0 Critical Flags')).toHaveTextContent('0')
    expect(
      screen.queryByRole('link', { name: /Show 0 Critical Flags/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Show all Message Flags' })
    ).toHaveAttribute('href', '?rubric=MESSAGE#report-flags')
  })
})
