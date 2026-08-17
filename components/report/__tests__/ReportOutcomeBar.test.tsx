import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'

function buildModel(): ReportWorkspaceModel {
  return buildCuratedSampleWorkspaceModel(buildSampleReportDisplay(getStaticSampleAudit()))
}

describe('ReportOutcomeBar', () => {
  it('states the outcome once: score, unresolved count, and verdict', () => {
    const model = buildModel()
    render(<ReportOutcomeBar model={model} verdict="The hero never names the outcome." />)

    expect(
      screen.getByRole('region', { name: REPORT_COPY.workspace.summaryLabel })
    ).toBeInTheDocument()
    expect(screen.getAllByText(REPORT_COPY.workspace.releaseScore)).toHaveLength(1)
    expect(screen.getAllByText(REPORT_COPY.workspace.unresolvedFlags)).toHaveLength(1)
    expect(
      screen.getAllByText(String(model.outcome.unresolvedCount))
    ).toHaveLength(1)
    expect(screen.getByText('The hero never names the outcome.')).toBeInTheDocument()
  })

  it('does not repeat the rubric counts the explorer filters already own', () => {
    render(<ReportOutcomeBar model={buildModel()} />)
    expect(screen.queryByRole('link', { name: /Show all Message Flags/i })).not.toBeInTheDocument()
  })

  it('links to the first Critical Flag when the review found one', () => {
    const model = buildModel()
    render(<ReportOutcomeBar model={model} />)
    expect(
      screen.getByRole('link', {
        name: REPORT_COPY.workspace.showCriticalFlags(model.outcome.criticalCount),
      })
    ).toHaveAttribute('href', expect.stringContaining('severity=CRITICAL'))
  })

  it('hides score history until a product has more than one review', () => {
    const model = buildModel()
    model.summary.history = []
    render(<ReportOutcomeBar model={model} />)
    expect(screen.queryByText(REPORT_COPY.workspace.history)).not.toBeInTheDocument()
  })

  it('reports honest progress while the review is still running', () => {
    const model = buildModel()
    model.context.loading = true
    model.summary.score = null
    render(<ReportOutcomeBar model={model} scanProgress={35} stageDetail="Checking Message" />)

    expect(screen.getByRole('status', { name: 'Scan progress' })).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
    expect(screen.getAllByText('Checking Message').length).toBeGreaterThan(0)
  })
})
