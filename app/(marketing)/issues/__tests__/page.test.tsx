import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPublicIssueLibrary, findMany } = vi.hoisted(() => ({ getPublicIssueLibrary: vi.fn(), findMany: vi.fn() }))
vi.mock('@/lib/graph/queries', () => ({ getPublicIssueLibrary, MIN_SAMPLE_SIZE: 5 }))
vi.mock('@/lib/db', () => ({ prisma: { issue: { findMany } } }))
import IssuesIndexPage, { generateMetadata } from '../page'
import { FLAG_LIBRARY } from '@/lib/marketing/copy/library'

describe('Flag Library', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('explains the publication threshold without claiming a made-up sample count', async () => {
    getPublicIssueLibrary.mockResolvedValue([])
    render(await IssuesIndexPage({}))
    expect(screen.getByRole('heading', { name: FLAG_LIBRARY.emptyTitle })).toBeInTheDocument()
    expect(screen.getByText(FLAG_LIBRARY.emptyBody(5))).toBeInTheDocument()
    expect(screen.queryByText(/Real Flags from/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: FLAG_LIBRARY.docsCta })).toHaveAttribute('href', '/coverage')
    expect(screen.getByRole('link', { name: FLAG_LIBRARY.startCta })).toHaveAttribute('href', '/new')
    expect(findMany).not.toHaveBeenCalled()
    expect((await generateMetadata()).robots).toMatchObject({ index: false, follow: true })
  })

  it('renders a useful title when a published pattern has no template', async () => {
    getPublicIssueLibrary.mockResolvedValue([{ checkId: 'missing-alt-text', rubric: 'EXPERIENCE', problemTemplate: null, siteCount: 7, occurrenceCount: 11 }])
    const view = render(await IssuesIndexPage({}))
    expect(screen.queryByRole('heading', { name: FLAG_LIBRARY.emptyTitle })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/alt text/i)
    expect(screen.getByText('11 occurrences across 7 sites')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /alt text/i })).toHaveAttribute('href', '/issues/missing-alt-text')
    const jsonLd = JSON.parse(view.container.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(JSON.stringify(jsonLd)).toContain('missing-alt-text')
    expect((await generateMetadata()).robots).toMatchObject({ index: true, follow: true })
  })

  it('retains an incoming campaign without turning an internal library link into an organic visit', async () => {
    getPublicIssueLibrary.mockResolvedValue([{ checkId: 'missing-alt-text', rubric: 'EXPERIENCE', problemTemplate: null, siteCount: 20, occurrenceCount: 20 }])
    render(await IssuesIndexPage({ searchParams: Promise.resolve({ utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'quality', token: 'private' }) }))
    expect(screen.getByRole('link', { name: /alt text/i })).toHaveAttribute('href', '/issues/missing-alt-text?utm_source=newsletter&utm_medium=email&utm_campaign=quality')
  })
})
