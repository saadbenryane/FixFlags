import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getIndexableIssueCheckIds, findMany } = vi.hoisted(() => ({ getIndexableIssueCheckIds: vi.fn(), findMany: vi.fn() }))
vi.mock('@/lib/graph/queries', () => ({ getIndexableIssueCheckIds, MIN_SAMPLE_SIZE: 5 }))
vi.mock('@/lib/db', () => ({ prisma: { issue: { findMany } } }))
import IssuesIndexPage from '../page'
import { FLAG_LIBRARY } from '@/lib/marketing/copy/library'

describe('Flag Library', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('explains the publication threshold without claiming a made-up sample count', async () => {
    getIndexableIssueCheckIds.mockResolvedValue([])
    render(await IssuesIndexPage())
    expect(screen.getByRole('heading', { name: FLAG_LIBRARY.emptyTitle })).toBeInTheDocument()
    expect(screen.getByText(FLAG_LIBRARY.emptyBody(5))).toBeInTheDocument()
    expect(screen.queryByText(/Real Flags from/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: FLAG_LIBRARY.docsCta })).toHaveAttribute('href', '/docs/site-care')
    expect(screen.getByRole('link', { name: FLAG_LIBRARY.startCta })).toHaveAttribute('href', '/new')
    expect(findMany).not.toHaveBeenCalled()
  })

  it('renders a useful title when a published pattern has no template', async () => {
    getIndexableIssueCheckIds.mockResolvedValue([{ checkId: 'missing-alt-text' }])
    findMany.mockResolvedValue([{ checkId: 'missing-alt-text', rubric: 'EXPERIENCE', problemTemplate: null, siteCount: 7, occurrenceCount: 11 }])
    const view = render(await IssuesIndexPage())
    expect(screen.queryByRole('heading', { name: FLAG_LIBRARY.emptyTitle })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/alt text/i)
    expect(screen.getByText('11 occurrences across 7 sites')).toBeInTheDocument()
    const jsonLd = JSON.parse(view.container.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(JSON.stringify(jsonLd)).toContain('missing-alt-text')
  })
})
