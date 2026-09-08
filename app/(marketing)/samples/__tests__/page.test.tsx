import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SamplesPage from '@/app/(marketing)/samples/page'
import { LATEST_STATIC_SAMPLE_OBSERVATION_ID } from '@/lib/marketing/static-sample'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({
  MarketingPageViewTracker: () => null,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

vi.mock('@/components/audit/AuditReport', () => ({
  AuditReport: (props: {
    projection?: {
      review: { id: string | null }
      workspace: { summary: { history: Array<{ id: string; href: string }> | null } }
    }
  }) => (
    <div
      data-testid="sample-report"
      data-observation={props.projection?.review.id}
    >
      {(props.projection?.workspace.summary.history ?? []).map((point) => (
        <a key={point.id} href={point.href}>{point.id}</a>
      ))}
    </div>
  ),
}))

describe('/samples', () => {
  it('loads a complete requested observation and full history destinations', async () => {
    render(
      await SamplesPage({
        searchParams: Promise.resolve({ observation: 'curated-sample-v0' }),
      }),
    )

    expect(screen.getByTestId('sample-report')).toHaveAttribute(
      'data-observation',
      'curated-sample-v0',
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'curated-sample-v0' })).toHaveAttribute(
      'href',
      '/samples?observation=curated-sample-v0&view=report',
    )
  })

  it('defaults an absent observation to the current immutable Review', async () => {
    render(await SamplesPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('sample-report')).toHaveAttribute('data-observation', LATEST_STATIC_SAMPLE_OBSERVATION_ID)
  })

  it('returns not found for an explicit unknown observation', async () => {
    await expect(
      SamplesPage({
        searchParams: Promise.resolve({ observation: 'not-a-published-observation' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
