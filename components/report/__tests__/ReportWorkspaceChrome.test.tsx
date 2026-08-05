import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ReportWorkspaceOutcome,
  ReportWorkspaceSummary,
} from '@/components/report/ReportWorkspaceChrome'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'

function buildModel(): ReportWorkspaceModel {
  const report = buildSampleReportDisplay(getStaticSampleAudit())
  return buildCuratedSampleWorkspaceModel(report)
}

describe('ReportWorkspaceOutcome', () => {
  it('renders the heading and context', () => {
    const model = buildModel()
    render(<ReportWorkspaceOutcome model={model} />)
    expect(screen.getByText('Your review')).toBeInTheDocument()
  })

  it('renders compact heading variant', () => {
    const model = buildModel()
    render(<ReportWorkspaceOutcome model={model} compact />)
    expect(screen.getByText('Your review')).toBeInTheDocument()
  })
})

describe('ReportWorkspaceSummary', () => {
  it('renders score ring, flag count, and history', () => {
    const model = buildModel()
    render(<ReportWorkspaceSummary model={model} />)
    expect(screen.getByText('Release score')).toBeInTheDocument()
    expect(screen.getByText('Unresolved Flags')).toBeInTheDocument()
    expect(screen.getByText('Score history')).toBeInTheDocument()
  })

  it('shows critical count link when flags are critical', () => {
    const model = buildModel()
    render(<ReportWorkspaceSummary model={model} />)
    const criticalCount = model.outcome.criticalCount
    expect(
      screen.getByRole('link', {
        name: `Show ${criticalCount} Critical ${criticalCount === 1 ? 'Flag' : 'Flags'}`,
      })
    ).toHaveAttribute('href', expect.stringContaining('severity=CRITICAL'))
  })

  it('shows no-critical-flags text when zero critical', () => {
    const model = buildModel()
    model.outcome.criticalCount = 0
    model.summary.rubrics.forEach((r) => { r.criticalCount = 0 })
    render(<ReportWorkspaceSummary model={model} />)
    expect(screen.getByLabelText('0 Critical Flags')).toHaveTextContent('No Critical Flags')
  })

  it('renders the score inside the ring without an out-of-100 line', () => {
    const model = buildModel()
    render(<ReportWorkspaceSummary model={model} />)
    if (model.summary.score != null) {
      expect(
        screen.getByRole('img', { name: `Score ${model.summary.score} percent` })
      ).toBeInTheDocument()
      expect(screen.queryByText(/out of 100/)).not.toBeInTheDocument()
    }
  })

  it('renders an honest live progress band while loading', () => {
    const model = buildModel()
    model.context.loading = true
    model.summary.score = null
    render(
      <ReportWorkspaceSummary
        model={model}
        scanProgress={5}
        stageDetail="Preparing your review…"
      />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('5%')).toBeInTheDocument()
    expect(
      screen.getAllByText('Preparing your review…').length
    ).toBeGreaterThan(0)
  })

  it('renders RubricBar with rubric links', () => {
    const model = buildModel()
    render(<ReportWorkspaceSummary model={model} />)
    const rubricNames = ['Message', 'Experience', 'Reach']
    for (const name of rubricNames) {
      const link = screen.queryByRole('link', { name: new RegExp(name, 'i') })
      expect(link).toBeInTheDocument()
    }
  })

  it('renders loading skeleton state', () => {
    const model = buildModel()
    model.context.loading = true
    model.summary.score = null
    render(<ReportWorkspaceSummary model={model} />)
    expect(screen.getByLabelText(/Release score, unresolved/i)).toBeInTheDocument()
  })
})
