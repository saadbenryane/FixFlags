import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportWorkspaceShell } from '@/components/report/ReportWorkspaceShell'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'

describe('ReportWorkspaceShell', () => {
  it('renders sections in status → action → work → context order', () => {
    const model = buildCuratedSampleWorkspaceModel(
      buildSampleReportDisplay(getStaticSampleAudit()),
    )

    const { container } = render(
      <ReportWorkspaceShell
        workspace={model}
        hero={<div data-testid="hero">Hero</div>}
        progressBand={<div data-testid="progress">Progress</div>}
        stickyNav={<div data-testid="sticky">Sticky</div>}
        polishPass={<div data-testid="polish" id="report-top-fixes">Top fixes</div>}
        flagsSection={<div data-testid="flags" id="report-flags">Flags</div>}
        contextSections={<div data-testid="context" id="report-stack">Context</div>}
      />,
    )

    const order = ['hero', 'progress', 'sticky', 'polish', 'flags', 'context']
    const nodes = order.map((id) => container.querySelector(`[data-testid="${id}"]`))
    for (const node of nodes) {
      expect(node).toBeTruthy()
    }
    const indices = nodes.map((node) =>
      Array.from(container.querySelectorAll('[data-testid]')).indexOf(node!),
    )
    expect(indices).toEqual([...indices].sort((a, b) => a - b))

    expect(screen.getByTestId('hero')).toBeInTheDocument()
    expect(screen.getByTestId('flags')).toBeInTheDocument()
  })
})
