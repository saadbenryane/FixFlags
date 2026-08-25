import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductWorkspace } from '@/components/product/ProductWorkspace'
import type { ProductWorkspaceDTO } from '@/lib/products/workspace'

vi.mock('@/components/audit/AuditInput', () => ({
  AuditInput: () => <div aria-label="Review input" />,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/components/audit/ProductWatchControls', () => ({
  ProductWatchControls: () => <div aria-label="Product Watch controls" />,
}))
vi.mock('@/components/dashboard/ProductSignalsSetup', () => ({
  ProductSignalsSetup: () => <div aria-label="Product Signal controls" />,
}))

const workspace: ProductWorkspaceDTO = {
  product: {
    id: 'product-1',
    name: 'Example Product',
    url: 'https://example.com',
    purpose: 'Help customers register',
    watching: true,
  },
  watch: {
    eligible: true,
    canDaily: false,
    interval: 'weekly',
    nextRunAt: '2026-08-20T00:00:00.000Z',
    lastRunAt: '2026-08-13T00:00:00.000Z',
    lastAttemptAt: '2026-08-13T00:00:00.000Z',
    consecutiveFailures: 0,
    lastError: null,
  },
  attention: [
    {
      id: 'improvement-1',
      title: 'Clarify signup',
      judgment: 'The action is hard to find.',
      recommendedChange: 'Move the action into the first view.',
      successCondition: 'The action is visible.',
      priority: 90,
      status: 'READY_TO_VERIFY',
      evidence: 'The action starts below the first view.',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      sourceReviewId: 'source-review',
      sourceFlagId: 'source-flag',
    },
  ],
  attentionCount: 1,
  activeManualReview: null,
  latestManualReview: {
    id: 'review-1',
    kind: 'PRODUCT_REVIEW',
    status: 'COMPLETED',
    score: 78,
    reportCompleteness: 'FULL',
    unresolvedCount: 1,
    createdAt: '2026-08-12T00:00:00.000Z',
    completedAt: '2026-08-12T00:01:00.000Z',
    failureMessage: null,
  },
  latestCompletedManualReview: {
    id: 'review-1',
    kind: 'PRODUCT_REVIEW',
    status: 'COMPLETED',
    score: 78,
    reportCompleteness: 'FULL',
    unresolvedCount: 1,
    createdAt: '2026-08-12T00:00:00.000Z',
    completedAt: '2026-08-12T00:01:00.000Z',
    failureMessage: null,
  },
  latestWatchReview: {
    id: 'watch-review',
    kind: 'WATCH',
    status: 'COMPLETED',
    score: 80,
    reportCompleteness: 'FULL',
    unresolvedCount: 1,
    createdAt: '2026-08-13T00:00:00.000Z',
    completedAt: '2026-08-13T00:01:00.000Z',
    failureMessage: null,
    regressionCount: 1,
    notificationStatus: 'SENT',
    notificationAttempts: 1,
    notificationError: null,
  },
  history: {
    events: [
      {
        kind: 'review',
        id: 'review:review-1',
        at: '2026-08-12T00:00:00.000Z',
        review: {
          id: 'review-1',
          kind: 'PRODUCT_REVIEW',
          status: 'COMPLETED',
          score: 78,
          reportCompleteness: 'FULL',
          unresolvedCount: 1,
          createdAt: '2026-08-12T00:00:00.000Z',
          completedAt: '2026-08-12T00:01:00.000Z',
          failureMessage: null,
        },
      },
    ],
    nextCursor: null,
  },
  integrations: {
    signalsEligible: true,
    signalKeys: [],
    lastSignalAt: null,
    observedContext: [],
  },
}

describe('ProductWorkspace', () => {
  it('keeps Product identity, exact source evidence, Watch outcome, and integrations together', () => {
    render(<ProductWorkspace workspace={workspace} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Example Product' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Help customers register')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'https://example.com' }),
    ).toHaveAttribute('href', 'https://example.com')
    expect(
      screen.getByRole('link', { name: /view report/i }),
    ).toHaveAttribute(
      'href',
      '/report/source-review?view=report&flag=source-flag',
    )
    expect(
      screen.getByText(/1 new or regressed issue found/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open watch review/i }),
    ).toHaveAttribute('href', '/report/watch-review?view=report')
  })

  it('uses a logical heading hierarchy for nested workspace regions', () => {
    render(<ProductWorkspace workspace={workspace} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Your priorities' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Recent activity' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Improvement history' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Remember' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Review history' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Product context',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Watch' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Product context' }),
    ).toBeInTheDocument()
  })

  it('shows an honest pending score and scopes prior Attention while a manual Review runs', () => {
    render(
      <ProductWorkspace
        workspace={{
          ...workspace,
          activeManualReview: {
            id: 'review-running',
            kind: 'UPDATE_REVIEW',
            status: 'CHECKING',
            score: null,
            reportCompleteness: 'UNKNOWN',
            unresolvedCount: 0,
            createdAt: '2026-08-20T00:00:00.000Z',
            completedAt: null,
            failureMessage: null,
          },
          latestManualReview: {
            id: 'review-running',
            kind: 'UPDATE_REVIEW',
            status: 'CHECKING',
            score: null,
            reportCompleteness: 'UNKNOWN',
            unresolvedCount: 0,
            createdAt: '2026-08-20T00:00:00.000Z',
            completedAt: null,
            failureMessage: null,
          },
        }}
      />,
    )

    expect(screen.getByLabelText('Score pending')).toBeInTheDocument()
    expect(screen.queryByText('-')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Ranked by the effect each issue has on the customer experience/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open review/i }),
    ).toHaveAttribute('href', '/report/review-running?view=report')
  })

  it('combines Reviews, declared changes, and verified learning in one Product history', () => {
    render(
      <ProductWorkspace
        workspace={{
          ...workspace,
          history: {
            events: [
              ...workspace.history.events,
              {
                kind: 'attempt' as const,
                id: 'attempt:attempt-1',
                at: '2026-08-14T00:00:00.000Z',
                improvementTitle: 'Clarify signup',
                attempt: {
                  id: 'attempt-1',
                  sourceReviewId: 'review-1',
                  sourceFlagId: 'flag-1',
                  builder: 'cursor',
                  changeSummary: 'Moved signup into the first view.',
                  deploymentReference: null,
                  verificationReviewId: 'review-2',
                  outcome: 'IMPROVED',
                  testedCondition: 'Signup is visible.',
                  comparable: true,
                  verificationCoverage: null,
                  verificationReason: null,
                  evidenceReference: null,
                  remainingRisk: null,
                  createdAt: '2026-08-14T00:00:00.000Z',
                },
              },
              {
                kind: 'learning' as const,
                id: 'learning:review-2:signup',
                at: '2026-08-15T00:00:00.000Z',
                learning: {
                  summary: 'Visible signup improves the first step.',
                  auditId: 'review-2',
                  at: '2026-08-15T00:00:00.000Z',
                },
              },
            ],
            nextCursor: null,
          },
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Recent activity' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Change declared: Clarify signup'),
    ).toBeInTheDocument()
    expect(screen.getByText('Verified learning')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /evidence from/i }),
    ).toHaveAttribute('href', '/report/review-2?view=report')
  })

  it('does not present a failed Review as a score or successful empty state', () => {
    const failedReview = {
      ...workspace.latestManualReview!,
      id: 'review-failed',
      status: 'FAILED' as const,
      score: null,
      reportCompleteness: 'UNKNOWN' as const,
      completedAt: null,
      failureMessage: 'The capture timed out.',
    }

    render(
      <ProductWorkspace
        workspace={{
          ...workspace,
          attention: [],
          attentionCount: 0,
          activeManualReview: null,
          latestManualReview: failedReview,
          latestCompletedManualReview: null,
          history: {
            events: [
              {
                kind: 'review',
                id: 'review:review-failed',
                at: failedReview.createdAt,
                review: failedReview,
              },
            ],
            nextCursor: null,
          },
        }}
      />,
    )

    expect(screen.getByLabelText('Score unavailable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The capture timed out.',
    )
    expect(
      screen.queryByText('Nothing important requires action now'),
    ).not.toBeInTheDocument()
  })

  it('labels Watch history honestly and links to an older server-rendered page only when present', () => {
    render(
      <ProductWorkspace
        workspace={{
          ...workspace,
          history: {
            events: [
              {
                kind: 'review',
                id: 'review:watch-review',
                at: '2026-08-13T00:00:00.000Z',
                review: workspace.latestWatchReview!,
              },
            ],
            nextCursor: {
              at: '2026-08-13T00:00:00.000Z',
              id: 'review:watch-review',
            },
          },
        }}
      />,
    )

    expect(screen.getByText('Watch review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Older history' })).toHaveAttribute(
      'href',
      '/products/product-1?historyCursor=2026-08-13T00%3A00%3A00.000Z%7Creview%3Awatch-review#product-history',
    )
  })

  it('does not label a failed Watch Review as in progress', () => {
    render(
      <ProductWorkspace
        workspace={{
          ...workspace,
          latestWatchReview: {
            ...workspace.latestWatchReview!,
            status: 'FAILED',
            score: null,
            reportCompleteness: 'UNKNOWN',
            completedAt: null,
            failureMessage: 'Watch capture failed.',
          },
        }}
      />,
    )

    expect(
      screen.getByText('Latest Watch Review: Review failed'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Latest Watch Review: In progress'),
    ).not.toBeInTheDocument()
  })
})
