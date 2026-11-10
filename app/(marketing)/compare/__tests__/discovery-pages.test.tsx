import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ComparePage, { metadata as compareMetadata } from '../page'
import FreeToolsPage, { metadata as toolsMetadata } from '../../tools/page'
import ForAgenciesPage, { metadata as agenciesMetadata } from '../../for-agencies/page'
import { COMPARE_PAGE } from '@/lib/marketing/copy/compare'
import { FREE_TOOLS_PAGE } from '@/lib/marketing/copy/free-tools'
import { AGENCIES_PAGE } from '@/lib/marketing/copy/agencies'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'
import { FOOTER_COLUMNS } from '@/lib/site/nav'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('discovery pages', () => {
  it('registers each page once for search, llms and the footer', () => {
    for (const [path, metadata] of [['/compare', compareMetadata], ['/tools', toolsMetadata], ['/for-agencies', agenciesMetadata]] as const) {
      expect(INDEXABLE_ROUTES.filter(route => route.path === path)).toHaveLength(1)
      expect(metadata.alternates?.canonical).toMatch(new RegExp(`${path}$`))
      expect(Object.values(FOOTER_COLUMNS).flat().filter(link => link.href === path)).toHaveLength(1)
    }
  })

  it('compares each tool with what it does, how FixFlags differs, when to choose it, and a source', () => {
    render(<ComparePage />)
    expect(screen.getByRole('heading', { level: 1, name: COMPARE_PAGE.title })).toBeVisible()
    for (const entry of COMPARE_PAGE.entries) {
      const section = screen.getByRole('region', { name: COMPARE_PAGE.entryTitle(entry.name) })
      expect(within(section).getByText(entry.theyDo)).toBeVisible()
      expect(within(section).getByText(entry.difference)).toBeVisible()
      expect(within(section).getByText(entry.choose)).toBeVisible()
      expect(within(section).getByRole('link', { name: entry.source.label })).toHaveAttribute('href', entry.source.href)
      expect(entry.source.href).toMatch(/^https:\/\//)
    }
    expect(screen.getByText(COMPARE_PAGE.checkedOn)).toBeVisible()
  })

  it('links every free tool and leads to the full check', () => {
    render(<FreeToolsPage />)
    for (const tool of FREE_TOOLS_PAGE.tools) expect(screen.getByRole('link', { name: FREE_TOOLS_PAGE.open(tool.name) })).toHaveAttribute('href', tool.href)
    expect(screen.getByRole('heading', { name: FREE_TOOLS_PAGE.fullCheck.title })).toBeVisible()
  })

  it('sells only what agencies can use today and names the limit once', () => {
    render(<ForAgenciesPage />)
    for (const step of AGENCIES_PAGE.steps) expect(screen.getByText(step.body)).toBeVisible()
    expect(screen.getByText(AGENCIES_PAGE.limits.body)).toBeVisible()
    expect(JSON.stringify(AGENCIES_PAGE).match(/coming soon/gi)).toHaveLength(1)
    expect(JSON.stringify(AGENCIES_PAGE)).not.toMatch(/about a minute|unlimited|client portal/i)
    expect(screen.getByRole('link', { name: AGENCIES_PAGE.limits.action })).toHaveAttribute('href', AGENCIES_PAGE.limits.href)
  })
})
