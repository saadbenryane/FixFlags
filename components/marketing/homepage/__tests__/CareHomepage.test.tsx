import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CareHomepage } from '../CareHomepage'
import { CARE_HOME as C, SITE_BOARD_COPY, SITE_COMPARE } from '@/lib/marketing/copy'
import { starterBoardNames } from '@/lib/sites/board-card'
import { CONFIRMABLE_OUTCOME_KINDS, watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'

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
    expect(within(workflow).getByRole('button', { name: C.workflow.viewFlag })).toBeInTheDocument()
    expect(within(workflow).getByRole('slider', { name: C.workflow.compareLabel })).toHaveAttribute('aria-valuenow', '18')
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
    const compare = screen.getByRole('heading', { name: new RegExp(SITE_COMPARE.headlineDisplay) })
    const compareSection = compare.closest('section')
    expect(hero).not.toBeNull()
    expect(workflow).not.toBeNull()
    expect(plans).not.toBeNull()
    expect(compareSection).not.toBeNull()
    expect(within(hero!).queryByRole('heading', { name: new RegExp(SITE_COMPARE.headlineDisplay) })).not.toBeInTheDocument()
    expect(workflow!.compareDocumentPosition(compareSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(compareSection!.compareDocumentPosition(plans!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(compareSection!).getAllByText(SITE_COMPARE.columns[0].label).length).toBeGreaterThan(0)
    expect(within(compareSection!).getAllByText(SITE_COMPARE.columns[1].label).length).toBeGreaterThan(0)
    expect(within(compareSection!).getByRole('columnheader', { name: SITE_COMPARE.columns[2].label })).toBeInTheDocument()
    expect(within(compareSection!).getByText((content) => content.includes(SITE_COMPARE.subline))).toBeInTheDocument()
  })

  it('renders one accessible comparison matrix at every viewport', () => {
    render(<CareHomepage />)
    const table = screen.getByRole('table', { name: SITE_COMPARE.mobileLabel })
    expect(within(table).getAllByRole('row')).toHaveLength(SITE_COMPARE.rows.length + 1)
    expect(within(table).getByLabelText('Datadog Synthetics: Browser checkout journey supported, Authored')).toBeInTheDocument()
    expect(within(table).getByLabelText('UptimeRobot: Browser checkout journey not included')).toBeInTheDocument()
  })

  it('renders the three workflow steps without scroll-gated content', () => {
    render(<CareHomepage />)
    const workflow = document.getElementById('flag-example')!
    expect(workflow).not.toHaveAttribute('data-active-step')
    expect(workflow.querySelectorAll('[data-step]')).toHaveLength(3)
    expect(workflow.querySelectorAll('[aria-current="step"]')).toHaveLength(0)
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
    expect(within(board).getByRole('button', { name: `Open ${C.site.label}` })).toHaveTextContent('1 Flag')
    expect(within(board).getByRole('button', { name: `Open ${C.flag.name}` })).toHaveTextContent('2 Flags')
    expect(within(board).getByRole('button', { name: 'Open Performance' })).toHaveTextContent('1 Flag')
    expect(within(board).getByText(C.boardLabel)).toBeInTheDocument()
    expect(within(board).getByText(C.flag.title)).toBeInTheDocument()
    expect(within(board).getByText(C.conversionFlags[1].title)).toBeInTheDocument()
    expect(within(board).queryByText('0 Flags')).not.toBeInTheDocument()
    expect(within(board).queryByRole('button', { name: /Checkout: Flag/ })).not.toBeInTheDocument()
    expect(within(board).queryByText(/contact/i)).not.toBeInTheDocument()
  })

  it('adds coverage and a connection through the single Site action', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    fireEvent.click(within(board).getByRole('button', { name: SITE_BOARD_COPY.addCard }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${C.library.accessibility.name}`) }))
    expect(within(board).getByRole('button', { name: `Open ${C.library.accessibility.name}` })).toBeInTheDocument()
    fireEvent.click(within(board).getByRole('button', { name: SITE_BOARD_COPY.addCard }))
    fireEvent.click(screen.getByRole('button', { name: /^Analytics/ }))
    expect(within(board).getByText('Session counts do not decide Clear.')).toBeInTheDocument()
  })

  it('opens the purchase Flag with evidence and restores focus', async () => {
    render(<CareHomepage />)
    const card = screen.getByRole('button', { name: `Open ${C.flag.name}` })
    card.focus()
    fireEvent.click(card)
    const dialog = screen.getByRole('dialog')
    for (const flag of C.conversionFlags) expect(within(dialog).getByText(flag.title)).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: C.flag.cropAlt })).toHaveAttribute('src', '/marketing/evidence/purchase-broken.png')
    expect(within(dialog).getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(card).toHaveFocus())
  })

  it('shows all three monitored-outcome cards without hiding them behind tabs', () => {
    render(<CareHomepage />)
    for (const audience of C.coverage.audiences) {
      expect(screen.getByRole('heading', { name: audience.question })).toBeInTheDocument()
      expect(screen.getByText(audience.monitored)).toBeInTheDocument()
    }
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    const coverage = screen.getByRole('heading', { name: C.coverage.title }).closest('section')!
    expect(coverage.querySelector('svg')).toBeNull()
    expect(within(coverage).getByText(C.coverage.analysis.join(' · '))).toBeInTheDocument()
  })

  it('keeps public Outcome claims aligned with the executable monitoring contract', () => {
    const claims = C.coverage.audiences.map((audience) => `${audience.question} ${audience.monitored}`).join(' · ')
    const watchable = new Set(watchableOutcomeKinds())
    const claimPatterns = {
      CHECKOUT: /(?:checkout|purchase flow)/i,
      AVAILABILITY: /(?:pages? (?:stay )?(?:available|reachable)|public page availability|product pages load)/i,
      SIGNUP: /sign\s?up/i,
      LOGIN: /log\s?in|login/i,
      PASSWORD_RESET: /password reset/i,
    } as const

    for (const kind of CONFIRMABLE_OUTCOME_KINDS) {
      expect(Boolean(claims.match(claimPatterns[kind])), `${kind} homepage claim`).toBe(watchable.has(kind))
    }
    expect(claims).not.toMatch(/forms? submit|core actions complete|success states appear/i)

    render(<CareHomepage />)
    expect(screen.getByText(C.coverage.boundary)).toBeVisible()
  })

  it('keeps each audience and monitored outcome visible in the document order', () => {
    render(<CareHomepage />)
    const headings = C.coverage.audiences.map(item => screen.getByRole('heading', { name: item.question }))
    expect(headings[0].compareDocumentPosition(headings[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(headings[1].compareDocumentPosition(headings[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps teammate and AI handoff actions inside the Fix step', () => {
    render(<CareHomepage />)
    const fixStep = screen.getByRole('heading', { name: C.workflow.steps[1].title }).closest('li')!
    expect(within(fixStep).getByRole('button', { name: C.actions.choices[1].action })).toBeInTheDocument()
    expect(within(fixStep).getByRole('button', { name: C.actions.choices[2].action })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: C.actions.title })).not.toBeInTheDocument()
  })

  it('copies the same evidence-backed Flag for a teammate or coding AI', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[1].action }))
    expect(await screen.findByText(C.actions.copied)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(C.workflow.instructions)
  })

  it('explains how to recover when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard unavailable'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[2].action }))
    expect(await screen.findByText(C.actions.copyFailed)).toBeInTheDocument()
  })

  it('shows three named Flags and one verified recovery', () => {
    render(<CareHomepage />)
    for (const item of C.monitoring.notifications) expect(screen.getAllByText(item.title).length).toBeGreaterThan(0)
    expect(C.monitoring.notifications.filter(item => item.tone === 'bad')).toHaveLength(3)
    expect(C.monitoring.notifications.filter(item => item.tone === 'good')).toHaveLength(1)
  })

  it('links each integration to a real destination', () => {
    render(<CareHomepage />)
    expect(screen.getByRole('link', { name: /See how each one connects/i })).toHaveAttribute('href', '/integrations')
    expect(screen.getByRole('link', { name: /Shopify/i })).toHaveAttribute('href', '/install')
    expect(screen.getByRole('link', { name: /Search Console/i })).toHaveAttribute('href', '/integrations#search-console')
    expect(screen.getByRole('link', { name: /GitHub/i })).toHaveAttribute('href', '/sign-in')
    expect(screen.queryByText(/Coming later/i)).not.toBeInTheDocument()
  })

  it('drags the before and after handle and opens the flag', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.compareFrame === 'true') {
        return { left: 0, width: 200, top: 0, right: 200, bottom: 120, height: 120, x: 0, y: 0, toJSON() { return {} } } as DOMRect
      }
      const index = C.workflow.steps.findIndex(step => step.id === this.dataset.step)
      const top = index < 0 ? 900 : index * 500 + 400
      return { left: 0, width: 10, top, right: 10, bottom: top + 10, height: 10, x: 0, y: top, toJSON() { return {} } } as DOMRect
    })
    render(<CareHomepage />)
    const handle = screen.getByRole('slider', { name: C.workflow.compareLabel })
    fireEvent.pointerDown(handle, { clientX: 150, pointerId: 1 })
    expect(handle).toHaveAttribute('aria-valuenow', '75')
    expect(screen.getByText(C.workflow.passedTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.workflow.viewFlag }))
    expect(within(screen.getByRole('dialog')).getByText(C.flag.title)).toBeInTheDocument()
  })

  it('rejects weak, chore-heavy, or unsupported homepage claims', () => {
    const { container } = render(<CareHomepage />)
    expect(container.textContent).not.toMatch(/One Flag\. Ready|Fix it yourself|Needs attention|Fresh check passed/i)
    expect(container.textContent).not.toMatch(/Connect MCP|MCP (watches|monitors)|real visitor failures|paid traffic/i)
    expect(container.textContent).not.toMatch(/controlled example|not a live assessment|testimonial|customers saved/i)
    expect(container.textContent).not.toMatch(/The proof is ready|Safe Form fixture|An important outcome changed|Evidence and the next step are ready|PageSpeed Insights|An agent you ask/i)
    expect(container.textContent).not.toMatch(/A page can disappear|The button responds\. The cart stays empty|Can people reach it\?|Did the fix restore it\?/i)
  })
})
