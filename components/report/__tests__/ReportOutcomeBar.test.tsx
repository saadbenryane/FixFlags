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
  it('shows one compact, rounded Score value without duplicated outcome copy', () => {
    const model = buildModel()
    model.summary.score = 69.6
    render(<ReportOutcomeBar model={model} />)

    expect(
      screen.getByRole('region', { name: REPORT_COPY.workspace.summaryLabel }),
    ).toBeInTheDocument()
    expect(screen.getByText('Score')).toBeVisible()
    expect(screen.getByLabelText('Score 70')).toBeInTheDocument()
    expect(screen.getByText('70')).toHaveClass('tabular-nums')
    expect(screen.queryByText(/Critical Flag/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Highest priority/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Start with the top Flag/i)).not.toBeInTheDocument()
  })

  it('renders chronological Review links and marks the current audit by ID', () => {
    const model = buildModel()
    render(<ReportOutcomeBar model={model} />)

    const history = screen.getByRole('navigation', { name: 'Review history' })
    const links = screen.getAllByRole('link')
    expect(history).toBeInTheDocument()
    expect(links).toHaveLength(2)
    expect(links[1]).toHaveAttribute('href', '/report/review-2?view=report')
    expect(links[1]).toHaveAttribute('aria-current', 'page')
  })

  it('keeps a single Review visible as real history', () => {
    const model = buildModel()
    model.summary.history = model.summary.history?.slice(-1) ?? null
    render(<ReportOutcomeBar model={model} />)

    expect(screen.getByRole('navigation', { name: 'Review history' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('shows Score pending and announces honest progress while scanning', () => {
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

    expect(screen.getByLabelText('Score pending')).toBeInTheDocument()
    expect(screen.getByText('pending')).toHaveClass('tabular-nums')
    expect(screen.getByRole('status', { name: 'Scan progress' })).toHaveTextContent(
      'Checking Message35%',
    )
  })

  it('shows Score unavailable instead of a dash when no score exists', () => {
    const model = buildModel()
    model.context.loading = false
    model.summary.score = null
    render(<ReportOutcomeBar model={model} />)

    expect(screen.getByLabelText('Score unavailable')).toBeInTheDocument()
    expect(screen.getByText('unavailable')).toBeVisible()
    expect(screen.queryByText('-')).not.toBeInTheDocument()
  })

  it('keeps optional actions beside the score and history', () => {
    render(
      <ReportOutcomeBar model={buildModel()} actions={<button type="button">Share</button>} />,
    )
    expect(screen.getByRole('button', { name: 'Share' })).toBeVisible()
  })
})
