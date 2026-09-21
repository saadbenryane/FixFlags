import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CareHomepage } from '../CareHomepage'
import { CARE_HOME as C, SITE_BOARD_COPY, SITE_COMPARE } from '@/lib/marketing/copy'
import { starterBoardNames } from '@/lib/sites/board-card'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('homepage conversion story', () => {
  it('shows one purchase-path Flag, Fix, Verify story with distinct evidence', () => {
    render(<CareHomepage />)
    const workflow = document.getElementById('flag-example')!
    for (const step of C.workflow.steps) expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
    expect(within(workflow).getByRole('img', { name: C.workflow.failedAlt })).toHaveAttribute('data-src', '/marketing/evidence/purchase-broken.png')
    expect(within(workflow).getByRole('img', { name: C.workflow.passedAlt })).toHaveAttribute('data-src', '/marketing/evidence/purchase-verified.png')
    expect(within(workflow).getByText(C.workflow.failedTitle)).toBeInTheDocument()
    expect(within(workflow).getByText(C.workflow.passedTitle)).toBeInTheDocument()
    expect(within(workflow).getAllByText(C.workflow.page)).toHaveLength(1)
    expect(within(workflow).getAllByText(C.workflow.source)).toHaveLength(1)
  })

  it('shows the locked compare table after workflow evidence and before plans', () => {
    const source = readFileSync(join(process.cwd(), 'components/marketing/homepage/CareHomepage.tsx'), 'utf8')
    expect(source).toMatch(/MarketingCompareSection/)
    render(<CareHomepage />)
    const hero = document.querySelector('section')
    const workflow = document.getElementById('flag-example')
    const plans = document.getElementById('plans')
    const compare = screen.getByRole('heading', { name: /What your site should answer/ })
    const compareSection = compare.closest('section')
    expect(hero).not.toBeNull()
    expect(workflow).not.toBeNull()
    expect(plans).not.toBeNull()
    expect(compareSection).not.toBeNull()
    expect(within(hero!).queryByRole('heading', { name: /What your site should answer/ })).not.toBeInTheDocument()
    expect(workflow!.compareDocumentPosition(compareSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(compareSection!.compareDocumentPosition(plans!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(compareSection!).getByText(SITE_COMPARE.columns[0].label)).toBeInTheDocument()
    expect(within(compareSection!).getByText(SITE_COMPARE.columns[1].label)).toBeInTheDocument()
    expect(within(compareSection!).getByRole('columnheader', { name: SITE_COMPARE.columns[2].label })).toBeInTheDocument()
    expect(within(compareSection!).getByText(SITE_COMPARE.subline)).toBeInTheDocument()
  })

  it('follows the reading position forward and backward through all three steps', async () => {
    let offset = 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = C.workflow.steps.findIndex(step => step.id === this.dataset.step)
      return { top: index * 500 + 300 - offset } as DOMRect
    })
    render(<CareHomepage />)
    const workflow = document.getElementById('flag-example')!
    expect(workflow).toHaveAttribute('data-active-step', 'flag')
    for (const index of [1, 2, 1, 0]) {
      offset = index * 500
      fireEvent.scroll(window)
      await waitFor(() => expect(workflow).toHaveAttribute('data-active-step', C.workflow.steps[index].id))
      expect(workflow.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
    }
  })

  it('keeps the established hero and real Analyze entry points', () => {
    const { container } = render(<CareHomepage />)
    const hero = container.querySelector('section')!
    expect(within(hero).getByRole('heading', { level: 1, name: /Your software runs\.\s*FixFlags watches\./i })).toBeInTheDocument()
    expect(within(hero).getByText(C.hero.body)).toBeInTheDocument()
    expect(within(hero).getByText(C.hero.proof)).toBeInTheDocument()
    expect(screen.getAllByTestId('url-entry')).toHaveLength(2)
    expect(hero.querySelector('[data-hero-scan]')).toBeNull()
  })

  it('uses the shared board taxonomy and plural Flag reality', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect([C.site.label, C.flag.name, ...C.cards.map(card => card.name)]).toEqual(starterBoardNames())
    expect(within(board).getByRole('button', { name: C.boardSummary })).toHaveTextContent('4')
    expect(within(board).getByRole('button', { name: `${C.flag.name}: ${C.flag.status}` })).toHaveTextContent('1 Flag')
    expect(within(board).getByRole('button', { name: 'Performance: 3 Flags' })).toHaveTextContent('3 Flags')
    expect(within(board).getByText(C.flag.title)).toBeInTheDocument()
    expect(within(board).getByRole('button', { name: /Checkout: Flag\. Cart did not update/ })).toBeInTheDocument()
    expect(within(board).queryByText(/contact/i)).not.toBeInTheDocument()
  })

  it('shows the fixed launch board without a non-persistent card library', () => {
    render(<CareHomepage />)
    expect(screen.queryByRole('button', { name: /Add card/i })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: C.boardAria })).queryByRole('button', { name: C.library.uptime.name })).not.toBeInTheDocument()
  })

  it('opens the purchase Flag with evidence and restores focus', async () => {
    render(<CareHomepage />)
    const card = screen.getByRole('button', { name: C.flag.name })
    card.focus()
    fireEvent.click(card)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(C.flag.title)).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: C.flag.cropAlt })).toHaveAttribute('src', '/marketing/evidence/purchase-broken.png')
    expect(within(dialog).getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(card).toHaveFocus())
  })

  it('defaults coverage to Website and switches examples without changing modes', () => {
    render(<CareHomepage />)
    const website = screen.getByRole('tab', { name: 'Website' })
    const store = screen.getByRole('tab', { name: 'Store' })
    expect(website).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(C.coverage.audiences[0].items[0])).toBeInTheDocument()
    fireEvent.click(store)
    expect(store).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(C.coverage.audiences[1].items[1])).toBeInTheDocument()
    expect(screen.queryByText(C.coverage.audiences[0].items[0])).not.toBeInTheDocument()
  })

  it('supports arrow, Home, and End keys across audience tabs', () => {
    render(<CareHomepage />)
    const website = screen.getByRole('tab', { name: 'Website' })
    website.focus()
    fireEvent.keyDown(website, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Store' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Store' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Web app' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Web app' }), { key: 'Home' })
    expect(website).toHaveFocus()
  })

  it('presents optional detail, teammate, and AI handoff routes', () => {
    render(<CareHomepage />)
    for (const choice of C.actions.choices) expect(screen.getByRole('heading', { name: choice.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[0].action }))
    expect(screen.getByText(C.workflow.instructions)).toBeVisible()
    expect(screen.getByText(C.actions.verify)).toBeInTheDocument()
  })

  it('copies the same evidence-backed Flag for a teammate or coding AI', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[1].action }))
    expect(await screen.findByText(C.actions.copied)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(C.workflow.instructions)
  })

  it('opens the details when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard unavailable'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[2].action }))
    expect(await screen.findByText(C.actions.copyFailed)).toBeInTheDocument()
    expect(screen.getByText(C.workflow.instructions)).toBeVisible()
  })

  it('shows two meaningful monitoring notifications', () => {
    render(<CareHomepage />)
    for (const item of C.quiet.notifications) expect(screen.getAllByText(item.title).length).toBeGreaterThan(0)
    expect(C.quiet.notifications).toHaveLength(2)
  })

  it('links the integration story to a real destination and Shopify action', () => {
    render(<CareHomepage />)
    expect(screen.getByRole('link', { name: /Explore integrations/i })).toHaveAttribute('href', '/integrations')
    expect(screen.getByRole('link', { name: /Connect Shopify/i })).toHaveAttribute('href', '/install')
    expect(screen.getByText(C.integrations.futureLabel)).toBeInTheDocument()
  })

  it('rejects weak, chore-heavy, or unsupported homepage claims', () => {
    const { container } = render(<CareHomepage />)
    expect(container.textContent).not.toMatch(/One Flag\. Ready|Fix it yourself|Needs attention|Fresh check passed/i)
    expect(container.textContent).not.toMatch(/Connect MCP|MCP (watches|monitors)|real visitor failures|paid traffic/i)
    expect(container.textContent).not.toMatch(/controlled example|not a live assessment|testimonial|customers saved/i)
  })
})
