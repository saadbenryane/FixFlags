import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CoveragePage, { metadata as coverageMetadata } from '@/app/(marketing)/coverage/page'
import SecurityPage from '@/app/(marketing)/security/page'
import UseCasesPage from '@/app/(marketing)/use-cases/page'
import HowItWorksPage from '@/app/(marketing)/how-it-works/page'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { PUBLIC_SITE_COPY as C } from '@/lib/marketing/copy/public-site'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { MeProvider } from '@/hooks/useMe'
import { SAMPLE_FLAGS } from '@/lib/marketing/copy/care-homepage'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))
vi.mock('@/lib/audit/start-scan-handoff', () => ({ startScanWithHandoff: vi.fn(), trackStartedAudit: vi.fn() }))

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
    render(<MeProvider initialUser={null}><UseCasesPage /></MeProvider>)
    for (const item of C.useCasesPage.cases) {
      expect(document.getElementById(item.id)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: item.title })).toHaveAttribute('href', `#${item.id}`)
      expect(screen.getByText(item.limits)).toBeVisible()
    }
    expect(screen.getAllByRole('link', { name: C.analyze }).every(link => link.getAttribute('href') === '/new')).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeEnabled()
    expect(screen.getByRole('button', { name: C.analyze })).toHaveAttribute('type', 'submit')
  })

  it('explains account access, public reports, and safe execution plainly', () => {
    render(<SecurityPage />)
    expect(screen.getByText(/anonymous analysis can show public-safe evidence/i)).toBeVisible()
    expect(screen.getByText(/Signup checks require an authorized, reversible test setup/)).toBeVisible()
    expect(screen.getByRole('link', { name: C.securityPage.terms })).toHaveAttribute('href', '/terms')
  })

  it('shows the three-part loop, broad coverage, and a real entry form', () => {
    render(<MeProvider initialUser={null}><HowItWorksPage /></MeProvider>)
    expect(screen.getAllByRole('heading', { name: C.howItWorks.title })).toHaveLength(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(C.howItWorks.steps.map(step => step.label)).toEqual(['Monitor', 'Flag', 'Fix'])
    expect(screen.getByRole('heading', { name: C.howItWorks.steps[0].title })).toBeVisible()
    for (const area of HOMEPAGE_CHECK_COVERAGE.areas) {
      expect(screen.getByRole('link', { name: area.name })).toHaveAttribute('href', `/coverage#${area.id}`)
    }
    expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeEnabled()
    expect(screen.getByRole('button', { name: C.analyze })).toHaveAttribute('type', 'submit')
    expect(screen.queryByText('Start with a URL.')).not.toBeInTheDocument()
    expect(screen.queryByText('Illustrative cart example')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check now' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: C.howItWorks.setupLink })).toHaveAttribute('href', '/coverage')
    expect(screen.getAllByRole('link', { name: C.sample }).every(link => link.getAttribute('href') === '/samples')).toBe(true)
  })

  it('keeps the Flag and copyable fix prompt together when choosing an example', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<MeProvider initialUser={null}><HowItWorksPage /></MeProvider>)
    for (const example of C.howItWorks.walkthrough.examples) {
      fireEvent.click(screen.getByRole('button', { name: example.label }))
      expect(screen.getByRole('button', { name: example.label })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('heading', { name: SAMPLE_FLAGS[example.id].title })).toBeVisible()
      const prompt = screen.getByText(SAMPLE_FLAGS[example.id].prompt)
      expect(prompt.tagName).toBe('BLOCKQUOTE')
      fireEvent.click(screen.getByRole('button', { name: C.howItWorks.walkthrough.copy }))
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(SAMPLE_FLAGS[example.id].prompt))
      expect(screen.getByRole('status')).toHaveTextContent(C.howItWorks.walkthrough.copied)
    }
    const comparison = screen.getByText(C.howItWorks.walkthrough.recoveryDetail).closest('details')!
    fireEvent.click(within(comparison).getByText(C.howItWorks.walkthrough.recoveryDetail))
    expect(within(comparison).getByRole('img', { name: C.howItWorks.example.recoveryAlt })).toBeVisible()
  })

  it('offers the selected prompt for manual copying when the clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('Unavailable')) }, configurable: true })
    render(<MeProvider initialUser={null}><HowItWorksPage /></MeProvider>)
    fireEvent.click(screen.getByRole('button', { name: C.howItWorks.walkthrough.copy }))
    const prompt = await screen.findByRole('textbox', { name: C.howItWorks.walkthrough.promptLabel })
    expect(prompt).toHaveValue(SAMPLE_FLAGS.availability.prompt)
    expect(prompt).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: C.howItWorks.walkthrough.examples[1].label }))
    expect(screen.queryByRole('textbox', { name: C.howItWorks.walkthrough.promptLabel })).not.toBeInTheDocument()
  })

  it('submits the bottom URL field through the existing analysis flow', async () => {
    vi.mocked(startScanWithHandoff).mockResolvedValue({ ok: true, siteId: 'sample-site' })
    render(<MeProvider initialUser={null}><HowItWorksPage /></MeProvider>)
    const field = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(field, { target: { value: 'example.com' } })
    fireEvent.click(screen.getByRole('button', { name: C.analyze }))
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com',
      body: expect.objectContaining({ url: 'https://example.com' }),
      navigate: expect.any(Function),
    })))
  })
})
