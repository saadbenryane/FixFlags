import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductWorkspace } from '@/components/product/ProductWorkspace'
import type { ProductWorkspaceDTO } from '@/lib/products/workspace'

vi.mock('@/components/audit/AuditInput', () => ({
  AuditInput: () => <div aria-label="Review input" />,
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
    latestReview: {
      id: 'watch-review',
      status: 'COMPLETED',
      createdAt: '2026-08-13T00:00:00.000Z',
      completedAt: '2026-08-13T00:01:00.000Z',
      regressionCount: 1,
      notificationStatus: 'SENT',
      notificationAttempts: 1,
      notificationError: null,
    },
  },
  attention: [{
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
    latestAttempt: null,
  }],
  attentionCount: 1,
  currentReview: {
    id: 'review-1',
    status: 'COMPLETED',
    score: 78,
    reportCompleteness: 'FULL',
    unresolvedCount: 1,
    createdAt: '2026-08-12T00:00:00.000Z',
    completedAt: '2026-08-12T00:01:00.000Z',
    failureMessage: null,
    isUpdateReview: false,
  },
  latestCompletedReview: {
    id: 'review-1',
    status: 'COMPLETED',
    score: 78,
    reportCompleteness: 'FULL',
    unresolvedCount: 1,
    createdAt: '2026-08-12T00:00:00.000Z',
    completedAt: '2026-08-12T00:01:00.000Z',
    failureMessage: null,
    isUpdateReview: false,
  },
  improvementHistory: [],
  memory: {
    purpose: 'Help customers register',
    firstValueJourney: 'Open signup',
    verifiedLearnings: [],
    knownRisks: [],
    intentionalNotes: [],
  },
  reviewHistory: [],
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

    expect(screen.getByRole('heading', { level: 1, name: 'Example Product' })).toBeInTheDocument()
    expect(screen.getByText('Help customers register')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByRole('link', { name: /open source evidence/i })).toHaveAttribute(
      'href',
      '/report/source-review?flag=source-flag#report-flags'
    )
    expect(screen.getByText(/1 new or regressed issue found/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open watch review/i })).toHaveAttribute(
      'href',
      '/report/watch-review'
    )
  })

  it('uses a logical heading hierarchy for nested workspace regions', () => {
    render(<ProductWorkspace workspace={workspace} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Attention now' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Improvement history' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Remember' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Review history' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Watch' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Product context' })).toBeInTheDocument()
  })
})
