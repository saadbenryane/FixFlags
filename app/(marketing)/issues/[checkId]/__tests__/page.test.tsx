import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { researchFixture } from '@/lib/graph/__tests__/fixtures/public-research'

const { getIssuePage, getRelatedIssues } = vi.hoisted(() => ({ getIssuePage: vi.fn(), getRelatedIssues: vi.fn() }))
vi.mock('@/lib/graph/queries', () => ({ getIssuePage, MIN_SAMPLE_SIZE: 20 }))
vi.mock('@/lib/graph/related', () => ({ getRelatedIssues }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
import IssuePage, { generateMetadata, dynamic } from '../page'

describe('reviewed issue page', () => {
  beforeEach(() => { vi.clearAllMocks(); getRelatedIssues.mockResolvedValue([]) })

  it('renders the research scope and limitations without identifiable examples', async () => {
    const dataset = researchFixture()
    getIssuePage.mockResolvedValue({
      ...dataset.issues[0], examples: [],
      research: {
        windowStart: dataset.windowStart, windowEnd: dataset.windowEnd, reviewedAt: dataset.reviewedAt,
        sampleSiteCount: dataset.sampleSiteCount, methodology: dataset.methodology, limitations: dataset.limitations,
      },
    })
    const { container } = render(await IssuePage({ params: Promise.resolve({ checkId: dataset.issues[0].checkId }) }))
    expect(screen.getByRole('heading', { name: 'Research scope' })).toBeInTheDocument()
    expect(screen.getByText(dataset.limitations[0])).toBeInTheDocument()
    expect(screen.getByText('100 reviewed sites, observed from 2026-09-01 to 2026-09-30.')).toBeInTheDocument()
    expect(screen.queryByText('What this looks like in the wild')).not.toBeInTheDocument()
    expect(screen.queryByText(/Data refreshes as new checks complete/)).not.toBeInTheDocument()
    const schema = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(schema['@graph']).toEqual(expect.arrayContaining([expect.objectContaining({
      '@type': 'Dataset', temporalCoverage: `${dataset.windowStart}/${dataset.windowEnd}`,
    })]))
    expect(container.textContent).not.toContain(dataset.permittedUseRef)
    expect(container.querySelector('a[href="/?ff_entry=issue_page"]')).not.toBeNull()
  })

  it('keeps incoming campaign tags through related research and the analysis handoff', async () => {
    const dataset = researchFixture()
    getIssuePage.mockResolvedValue({ ...dataset.issues[0], examples: [], research: { ...dataset } })
    getRelatedIssues.mockResolvedValue([{ href: '/issues/other', title: 'Other reviewed issue', siteCount: 20 }])
    const { container } = render(await IssuePage({ params: Promise.resolve({ checkId: dataset.issues[0].checkId }),
      searchParams: Promise.resolve({ utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'quality', token: 'private' }),
    }))
    expect(screen.getByRole('link', { name: 'Run a free check' })).toHaveAttribute('href', '/?ff_entry=issue_page&utm_source=newsletter&utm_medium=email&utm_campaign=quality')
    expect(screen.getByRole('link', { name: /Other reviewed issue/ })).toHaveAttribute('href', '/issues/other?utm_source=newsletter&utm_medium=email&utm_campaign=quality')
    expect(container.innerHTML).not.toContain('token=private')
  })

  it('withholds unavailable research from rendering and indexing on every request', async () => {
    getIssuePage.mockResolvedValue(null)
    const props = { params: Promise.resolve({ checkId: 'security-headers-missing' }) }
    expect((await generateMetadata(props)).robots).toMatchObject({ index: false, follow: false })
    await expect(IssuePage(props)).rejects.toThrow('NOT_FOUND')
    expect(getRelatedIssues).not.toHaveBeenCalled()
    expect(dynamic).toBe('force-dynamic')
  })
})
