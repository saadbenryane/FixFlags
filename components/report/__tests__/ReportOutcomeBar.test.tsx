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
      coverageSentence: null,
      coveragePartial: false,
    },
    capabilities: {
      promptAccess: 'none',
      canCopyPrompts: false,
      canReplayTimeline: false,
      canChat: false,
      canUseCanvas: false,
      canShare: false,
      canExport: false,
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
  it('shows the score and chronological Review history without Product identity', () => {
    render(<ReportOutcomeBar model={buildModel()} />)

    expect(screen.getByRole('region', { name: REPORT_COPY.workspace.summaryLabel })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Score 70/)).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Review history' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How scores work' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByText('example.com')).not.toBeInTheDocument()
  })

  it('explains a flat update-review score with Fixed and New counts', () => {
    const model = buildModel()
    model.summary.history = [
      {
        id: 'review-1',
        href: '/report/review-1?view=report',
        score: 70,
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
    ]
    model.summary.updateDiff = {
      fixed: [
        {
          checkId: 'h1-generic',
          problem: 'Hero headline is generic',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          status: 'FIXED',
        },
      ],
      unchanged: [],
      newIssues: [
        {
          checkId: 'form-missing-validation',
          problem: 'Form fields lack validation',
          rubric: 'EXPERIENCE',
          severity: 'IMPORTANT',
          status: 'OPEN',
        },
      ],
      regressed: [],
      inconclusive: [],
    }
    render(<ReportOutcomeBar model={model} />)

    expect(screen.getByRole('region', { name: 'See what changed in this update review' })).toBeInTheDocument()
    expect(screen.getByText('Fixed')).toBeVisible()
    expect(screen.getByText('New')).toBeVisible()
    expect(
      screen.getByText(
        'Score stayed at 70. 1 Flag from last time is gone, and 1 new observation appeared on pages already reviewed.'
      )
    ).toBeVisible()
  })

  it('announces honest progress and a pending Score while scanning', () => {
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

    expect(screen.getByLabelText(/^Score pending/)).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Scan progress' })).toHaveTextContent(
      'Checking Message35%',
    )
  })

  it('shows an honest unavailable Score without inventing history', () => {
    const model = buildModel()
    model.summary.score = null
    model.summary.history = null
    render(<ReportOutcomeBar model={model} />)

    expect(screen.getByLabelText(/^Score unavailable/)).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Review history' })).not.toBeInTheDocument()
  })
})
