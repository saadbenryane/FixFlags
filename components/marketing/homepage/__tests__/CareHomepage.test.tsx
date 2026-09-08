import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CareHomepage } from '../CareHomepage'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { starterBoardNames } from '@/lib/sites/board-card'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('homepage example', () => {
  it('shows the complete Check, Flag, Fix, Verify story without hidden tabs', () => {
    render(<CareHomepage />)
    for (const step of C.workflow.steps) {
      expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
    }
    expect(screen.getByRole('img', { name: C.workflow.failedAlt })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: C.workflow.passedAlt })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('identifies the example Site once in the board chrome', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect(within(board).getAllByText(C.boardHost)).toHaveLength(1)
    expect(within(board).getByText(C.boardMeta)).toBeInTheDocument()
    expect(within(board).queryAllByText(/just now/i)).toHaveLength(1)
    expect(within(board).getByText(C.boardChecking)).toHaveAttribute('aria-hidden', 'true')
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
    const site = within(board).getByRole('button', { name: new RegExp(`^${C.site.label}`) })
    expect(within(site).getByRole('img', { name: C.site.imageAlt })).toBeInTheDocument()
    expect(within(site).getByText(C.site.status)).toBeInTheDocument()
    expect(within(site).getByText(`${C.site.pages} · ${C.site.flags}`)).toBeInTheDocument()
    const conversion = within(board).getByRole('link', { name: new RegExp(C.flag.title) })
    expect(conversion).toHaveAttribute('href', '#flag-example')
    expect(within(conversion).getByText(C.flag.name)).toBeInTheDocument()
    expect(within(conversion).getByText(C.flag.outcome)).toBeInTheDocument()
    expect(within(conversion).getByText(C.flag.body)).toBeInTheDocument()
    expect(within(conversion).getByText(C.flag.status)).toBeInTheDocument()
    expect(within(board).getByRole('img', { name: C.flag.cropAlt })).toBeInTheDocument()
    expect(within(board).getAllByRole('button')).toHaveLength(5)
    for (const card of C.cards) {
      expect(within(board).getByRole('button', { name: new RegExp(`^${card.name}`) }).textContent).toContain(card.status)
    }
    expect(within(board).queryByRole('button', { name: /Add card/i })).not.toBeInTheDocument()
    expect(within(board).queryByRole('button', { name: /^Conversion/ })).not.toBeInTheDocument()
  })

  it('does not sell a fake Add-card library', () => {
    render(<CareHomepage />)
    expect(screen.queryByText('Choose another area to watch.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add card/i })).not.toBeInTheDocument()
  })

  it('opens card depth as a question, answer, facts, and coverage', () => {
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${C.cards[0].name}`) }))
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

  it('opens Conversion as the Flag story instead of a second metric essay', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    const conversion = within(board).getByRole('link', { name: new RegExp(C.flag.title) })
    expect(conversion).toHaveAttribute('href', '#flag-example')
    expect(within(conversion).getByText(C.flag.outcome)).toBeInTheDocument()
    expect(within(board).queryByRole('button', { name: /^Conversion/ })).not.toBeInTheDocument()
  })

  it('restores focus to the card that opened the dialog', async () => {
    render(<CareHomepage />)
    const card = screen.getByRole('button', { name: new RegExp(`^${C.cards[0].name}`) })
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
