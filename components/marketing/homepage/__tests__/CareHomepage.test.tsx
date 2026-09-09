import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CareHomepage } from '../CareHomepage'
import { CARE_HOME as C, SITE_BOARD_COPY } from '@/lib/marketing/copy'
import { starterBoardNames } from '@/lib/sites/board-card'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('homepage example', () => {
  it('shows the complete Check, Flag, Fix, Verify story without hidden tabs', () => {
    render(<CareHomepage />)
    const workflow = screen.getByRole('region', { name: C.boardAria }).ownerDocument.getElementById('flag-example')
    expect(workflow).not.toBeNull()
    for (const step of C.workflow.steps) {
      expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
    }
    expect(screen.getByRole('img', { name: C.workflow.failedAlt })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: C.workflow.passedAlt })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(within(workflow!).queryByRole('link', { name: C.hero.cta })).not.toBeInTheDocument()
    expect(within(workflow!).queryByText(C.flag.outcome)).not.toBeInTheDocument()
    expect(within(workflow!).getAllByText(C.workflow.page)).toHaveLength(2)
    expect(within(workflow!).getAllByText(C.workflow.source)).toHaveLength(1)
    expect(within(workflow!).getByText(C.workflow.failedTitle)).toBeInTheDocument()
    expect(within(workflow!).getByText(C.workflow.passedTitle)).toBeInTheDocument()
    expect(workflow!.querySelectorAll('[data-step]')).toHaveLength(C.workflow.steps.length)
  })

  it('follows the reading position forward and backward through all four steps', async () => {
    let offset = 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = C.workflow.steps.findIndex(step => step.id === this.dataset.step)
      return { top: index * 500 + 300 - offset } as DOMRect
    })
    render(<CareHomepage />)
    const workflow = document.getElementById('flag-example')!
    expect(workflow).toHaveAttribute('data-active-step', 'check')
    for (const index of [1, 2, 3, 2, 1, 0]) {
      offset = index * 500
      fireEvent.scroll(window)
      await waitFor(() => expect(workflow).toHaveAttribute('data-active-step', C.workflow.steps[index].id))
      expect(workflow.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
    }
  })

  it('identifies the example Site once in the board chrome', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect(within(board).getAllByText(C.boardHost)).toHaveLength(1)
    expect(within(board).getByRole('button', { name: C.boardSummary })).toBeInTheDocument()
    expect(within(board).queryAllByText(/just now|last checked/i)).toHaveLength(0)
    expect(board.querySelector('[data-hero-scan]')).not.toBeNull()
    expect(within(board).queryByText('How this website is doing')).not.toBeInTheDocument()
    expect(within(board).queryByText('Example Site')).not.toBeInTheDocument()
    expect(within(board).queryByText('Experience')).not.toBeInTheDocument()
    expect(within(board).queryByText('Contact needs you')).not.toBeInTheDocument()
    expect(within(board).queryByText('1 Flag needs attention')).not.toBeInTheDocument()
    expect(within(board).queryByText('Buy')).not.toBeInTheDocument()
    expect(board.parentElement?.querySelector('[class*="attentionPulse"]')).toBeNull()
  })

  it('uses CARD_CATALOG starter names and Conversion as the Flag card', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect([
      C.site.label,
      C.flag.name,
      ...C.cards.map(card => card.name),
    ]).toEqual(starterBoardNames())
    const site = within(board).getByRole('button', { name: C.site.label })
    expect(within(site).getByRole('img', { name: C.site.imageAlt })).toBeInTheDocument()
    expect(within(board).queryByText(SITE_BOARD_COPY.lastChecked)).not.toBeInTheDocument()
    expect(within(site).getByText(C.site.answer)).toBeInTheDocument()
    const conversion = within(board).getByRole('button', { name: C.flag.name })
    expect(within(conversion).getByText(C.flag.body)).toBeInTheDocument()
    expect(within(board).getByRole('button', { name: 'Conversion: Needs a fix' })).toHaveTextContent('1 Flag')
    expect(within(board).queryByRole('img', { name: C.flag.cropAlt })).not.toBeInTheDocument()
    expect(within(board).getByRole('button', { name: 'Performance: Needs attention' })).toHaveTextContent('3 Flags')
    expect(within(board).getByRole('button', { name: /Add card/i })).toBeInTheDocument()
    for (const card of C.cards) {
      expect(within(board).getByRole('button', { name: card.name })).toBeInTheDocument()
    }
  })

  it('offers Uptime and Accessibility from Add without selling connections', () => {
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: /Add card/i }))
    const library = screen.getByRole('dialog')
    expect(within(library).getByRole('heading', { name: SITE_BOARD_COPY.addTitle })).toBeInTheDocument()
    expect(within(library).getByText(C.add.note)).toBeInTheDocument()
    expect(within(library).queryByText(/Connect MCP/i)).not.toBeInTheDocument()
    expect(within(library).queryByText(/Connect Analytics/i)).not.toBeInTheDocument()
    fireEvent.click(within(library).getByRole('button', { name: /Uptime/i }))
    const board = screen.getByRole('region', { name: C.boardAria })
    expect(within(board).getByRole('button', { name: C.library.uptime.name })).toBeInTheDocument()
  })

  it('opens card depth as a question, answer, facts, and coverage', () => {
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.cards[0].name }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: C.cards[0].name })).toBeInTheDocument()
    expect(within(dialog).getByText(C.cards[0].question)).toBeInTheDocument()
    expect(within(dialog).getByText(C.cards[0].answer)).toBeInTheDocument()
    for (const fact of C.cards[0].facts) {
      expect(within(dialog).getByText(fact)).toBeInTheDocument()
    }
    expect(within(dialog).getByText(C.cards[0].coverage)).toBeInTheDocument()
    expect(within(dialog).queryByText('What happened')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Why it matters')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('What next')).not.toBeInTheDocument()
  })

  it('opens Conversion depth with proof and copy actions, and keeps full proof behind the card', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect(within(board).getByRole('button', { name: 'Conversion: Needs a fix' })).toBeInTheDocument()
    fireEvent.click(within(board).getByRole('button', { name: C.flag.name }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: C.flag.name })).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: C.flag.cropAlt })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: SITE_BOARD_COPY.share })).toBeInTheDocument()
  })

  it('restores focus to the card that opened the dialog', async () => {
    render(<CareHomepage />)
    const card = screen.getByRole('button', { name: C.cards[0].name })
    card.focus()
    fireEvent.click(card)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(card).toHaveFocus())
  })

  it('lets the visitor compare concrete website outcomes', () => {
    render(<CareHomepage />)
    expect(screen.getByText(C.outcomes.options[2].result)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.outcomes.options[0].label }))
    expect(screen.getByText(C.outcomes.options[0].result)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: C.outcomes.options[0].label })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers read, share, and AI routes while keeping one verification contract', () => {
    render(<CareHomepage />)
    for (const choice of C.actions.choices) {
      expect(screen.getByRole('heading', { name: choice.title })).toBeInTheDocument()
    }
    expect(screen.getByText(C.actions.verify)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[0].action }))
    expect(screen.getByText(C.workflow.instructions)).toBeVisible()
  })

  it('copies the same evidence-backed instructions for a teammate or AI', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.actions.choices[1].action }))
    expect(await screen.findByText(C.actions.copied)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(C.workflow.instructions)
  })

  it('exposes the fix when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard unavailable'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CareHomepage />)
    fireEvent.click(screen.getAllByRole('button', { name: C.mcp.copy })[0]!)
    expect(await screen.findByText(C.actions.copyFailed)).toBeInTheDocument()
    expect(screen.getByText(C.workflow.instructions)).toBeVisible()
    expect(writeText).toHaveBeenCalledWith(C.workflow.instructions)
  })

  it('keeps Copy prompt and does not sell parked MCP', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = render(<CareHomepage />)
    expect(screen.getByRole('heading', { name: C.mcp.title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect MCP/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: C.mcp.copy })[0]!)
    expect(await screen.findByText(C.actions.copied)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(C.workflow.instructions)
    for (const step of C.mcp.flow) {
      expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
    }
    expect(container.textContent).not.toMatch(/ff_[a-z_]+/)
    expect(container.textContent).not.toMatch(/MCP (watches|monitors)/i)
    expect(container.textContent).not.toMatch(/Connect MCP/)
    expect(container.innerHTML).not.toMatch(/\/docs\/cli|\/docs\/mcp|\/help\/mcp-and-editors/)
  })

  it('uses the awareness promise and rejects the discarded broad copy', () => {
    const { container } = render(<CareHomepage />)
    expect(screen.getByText(/100\+ checks and real browser journeys/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: C.checks.title })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/More than uptime|One clear path from problem to proof|Keep what matters in view|over 200/i)
    expect(screen.getAllByText(C.quiet.notifications[2].title).length).toBeGreaterThan(0)
    expect(screen.getByText(C.quiet.exampleNote)).toBeInTheDocument()
  })
})
