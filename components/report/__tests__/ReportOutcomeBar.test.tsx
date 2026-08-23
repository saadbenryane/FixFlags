import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'

function buildModel(): ReportWorkspaceModel {
  return {
    identity: {
      auditId: 'review-2',
      displayHost: 'example.com',
      url: 'https://example.com',
      pageType: 'Landing page',
      checkedAt: new Date('2026-07-28T10:00:00Z'),
      status: 'completed',
    },
    outcome: {
      unresolvedCount: 1,
    },
    summary: {
      score: 70,
      rubrics: [],
      history: [
        {
          id: 'review-1',
          href: '/report/review-1?view=report',
          score: 64,
          checkedAt: new Date('2026-07-21T10:00:00Z'),
          kind: 'product-review',
          status: 'completed',
        },
        {
          id: 'review-2',
          href: '/report/review-2?view=report',
          score: 70,
          checkedAt: new Date('2026-07-28T10:00:00Z'),
          kind: 'update-review',
          status: 'completed',
        },
      ],
    },
    explorer: {
      displayHost: 'example.com',
      pageType: 'Landing page',
      score: 70,
      flagCount: 0,
      polishPassPrompt: null,
      desktopScreenshot: null,
      mobileScreenshot: null,
      rubricScores: [],
      flags: [],
      allHighlights: [],
      previewMeta: null,
    },
    capabilities: {
      promptAccess: 'none',
      canCopyPrompts: false,
      canReplayTimeline: false,
      canChat: false,
      canUseCanvas: false,
      canShare: false,
      canRecheck: false,
      canGiveFeedback: false,
      demonstratedFlagId: null,
    },
    context: {
      kind: 'completed',
      loading: false,
    },
  }
}

describe('ReportOutcomeBar', () => {
  it('shows only the report name and a way back to the reports list', () => {
    render(<ReportOutcomeBar model={buildModel()} />)

    expect(screen.getByRole('region', { name: 'example.com' })).toBeInTheDocument()
    expect(screen.getByText('example.com')).toBeVisible()
    expect(screen.getByRole('link', { name: REPORT_COPY.workspace.dashboard.title })).toHaveAttribute(
      'href',
      '/dashboard',
    )
    expect(screen.queryByText('Score')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Review history' })).not.toBeInTheDocument()
  })

  it('announces honest progress while scanning without restoring Score', () => {
    const model = buildModel()
    model.context.loading = true
    model.summary.score = null
    render(
      <ReportOutcomeBar
        model={model}
        scanProgress={35.4}
        stageDetail="Checking Message"
      />,
    )

    expect(screen.queryByLabelText('Score pending')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Scan progress' })).toHaveTextContent(
      'Checking Message35%',
    )
  })
})
