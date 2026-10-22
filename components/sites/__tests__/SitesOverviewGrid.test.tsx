import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SitesOverviewGrid } from '../SitesOverviewGrid'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { SiteSummary } from '@/lib/sites/application/list-sites'

function site(): SiteSummary {
  return { id: 'example', name: 'Example', hostname: 'example.com',
    presentation: siteViewFixture().presentation, lastUsefulChangeAt: '2026-10-21T10:00:00Z' }
}

describe('Websites overview', () => {
  it('keeps monitoring, result, coverage, and freshness distinct and renders each once', () => {
    const website = site()
    website.presentation.freshness.label = 'Checked just now'
    render(<SitesOverviewGrid sites={[website]} />)
    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('href', '/sites/example')
    expect(within(row).getAllByText('Not monitored')).toHaveLength(1)
    expect(within(row).getAllByText('Not verified')).toHaveLength(1)
    expect(within(row).getAllByText('1 page')).toHaveLength(1)
    expect(within(row).getAllByText('Checked just now')).toHaveLength(1)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('does not show zero Flags as clear when the result is unverified', () => {
    const website = site()
    website.presentation.freshness.label = 'No completed check'
    render(<SitesOverviewGrid sites={[website]} />)
    expect(screen.getByText('Not verified').closest('dd')).toHaveAttribute('data-tone', 'pending')
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
  })

  it('keeps known Flags visible while a new check runs', () => {
    const website = site()
    website.presentation.result = { state: 'checking', label: 'Checking' }
    website.presentation.flags = { count: 2, label: '2 Flags', fixFirstCount: 1 }
    render(<SitesOverviewGrid sites={[website]} />)
    expect(screen.getByText('2 Flags').closest('dd')).toHaveAttribute('data-tone', 'attention')
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
  })

  it('does not add a second empty state before a customer has a website', () => {
    const { container } = render(<SitesOverviewGrid sites={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
