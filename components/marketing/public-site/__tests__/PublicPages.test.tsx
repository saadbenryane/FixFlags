import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CoveragePage, { metadata as coverageMetadata } from '@/app/(marketing)/coverage/page'
import SecurityPage from '@/app/(marketing)/security/page'
import UseCasesPage from '@/app/(marketing)/use-cases/page'
import HowItWorksPage from '@/app/(marketing)/how-it-works/page'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { PUBLIC_SITE_COPY as C } from '@/lib/marketing/copy/public-site'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('public supporting pages', () => {
  it('publishes all three additions in search and machine-readable discovery', () => {
    for (const path of ['/coverage', '/security', '/use-cases']) {
      expect(INDEXABLE_ROUTES.some(route => route.path === path)).toBe(true)
      expect(LLMS_SECTIONS.flatMap(section => section.links).some(link => link.path === path)).toBe(true)
    }
    expect(coverageMetadata.alternates?.canonical).toMatch(/\/coverage$/)
  })

  it('shows eight coverage areas with evaluator-backed setup and limits', () => {
    render(<CoveragePage />)
    for (const area of HOMEPAGE_CHECK_COVERAGE.areas) {
      expect(document.getElementById(area.id)).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: area.name })).toBeVisible()
    }
    fireEvent.click(document.querySelector('#conversion summary')!)
    expect(screen.getAllByText(C.coveragePage.setup.signup_fixture)[0]).toBeVisible()
    expect(screen.getAllByText(C.coveragePage.extent.heuristic, { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Couldn’t verify' })).toBeVisible()
  })

  it('gives each operator a real anchor and bounded setup guidance', () => {
    render(<UseCasesPage />)
    for (const item of C.useCasesPage.cases) {
      expect(document.getElementById(item.id)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: item.title })).toHaveAttribute('href', `#${item.id}`)
      expect(screen.getByText(item.limits)).toBeVisible()
    }
    expect(screen.getAllByRole('link', { name: C.analyze }).every(link => link.getAttribute('href') === '/new')).toBe(true)
  })

  it('explains account access, public reports, and safe execution plainly', () => {
    render(<SecurityPage />)
    expect(screen.getByText(/anonymous analysis can show public-safe evidence/i)).toBeVisible()
    expect(screen.getByText(/Signup checks require an authorized, reversible test setup/)).toBeVisible()
    expect(screen.getByRole('link', { name: C.securityPage.terms })).toHaveAttribute('href', '/terms')
  })

  it('explains the full workflow once and provides a public sample before signup', () => {
    render(<HowItWorksPage />)
    expect(screen.getAllByRole('heading', { name: C.howItWorks.title })).toHaveLength(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('heading', { name: 'Publish the fix' })).toBeVisible()
    expect(screen.getByRole('link', { name: C.howItWorks.setupLink })).toHaveAttribute('href', '/coverage')
    expect(screen.getAllByRole('link', { name: C.sample }).every(link => link.getAttribute('href') === '/samples')).toBe(true)
  })
})
