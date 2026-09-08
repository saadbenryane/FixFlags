import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CareHomepage } from '../CareHomepage'
import { CARE_HOME as C } from '@/lib/marketing/copy'

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

  it('identifies the example Site in the board chrome without duplicated status', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect(within(board).getAllByText(C.boardHost)).toHaveLength(2)
    expect(within(board).getByText(C.boardMeta)).toBeInTheDocument()
    expect(within(board).queryAllByText(/just now/i)).toHaveLength(1)
    expect(within(board).queryByText('How this website is doing')).not.toBeInTheDocument()
    expect(within(board).queryByText('Example Site')).not.toBeInTheDocument()
    expect(within(board).queryByText('1 Flag needs attention')).not.toBeInTheDocument()
    expect(within(board).queryByText('12 pages checked')).not.toBeInTheDocument()
    expect(within(board).queryByText('Buy')).not.toBeInTheDocument()
  })

  it('anchors the board with Site and Flag, then five cards and Add card last', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    const site = within(board).getByRole('article', { name: C.siteSummary.label })
    expect(within(site).getByRole('img', { name: C.siteSummary.imageAlt })).toBeInTheDocument()
    expect(within(site).getByText(C.siteSummary.status)).toBeInTheDocument()
    expect(within(site).getByText(C.siteSummary.pages)).toBeInTheDocument()
    expect(within(site).getByText(C.siteSummary.flags)).toBeInTheDocument()
    expect(within(board).getByRole('link', { name: new RegExp(C.flag.title) })).toBeInTheDocument()
    expect(within(board).getByText(C.flag.body)).toBeInTheDocument()
    expect(within(board).getByRole('img', { name: C.flag.cropAlt })).toBeInTheDocument()
    expect(within(board).queryByText('Contact page · Submit form')).not.toBeInTheDocument()
    const buttons = within(board).getAllByRole('button')
    expect(buttons).toHaveLength(6)
    expect(buttons.slice(0, 5).map(button => button.textContent)).toEqual(
      C.cards.map(card => expect.stringContaining(card.name)),
    )
    expect(buttons.at(-1)).toHaveAccessibleName(C.boardAdd.title)
  })

  it('adds another card to the hero board and prevents duplicate additions', async () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    fireEvent.click(within(board).getByRole('button', { name: C.boardAdd.title }))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(C.addCards.options[0].name) }))
    expect(within(board).getByText(C.addCards.options[0].detail)).toBeInTheDocument()
    fireEvent.click(within(board).getByRole('button', { name: C.boardAdd.title }))
    expect(await screen.findByRole('button', { name: new RegExp(C.addCards.options[0].name) })).toBeDisabled()
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

  it('opens the Flag story from Conversion instead of a separate essay', () => {
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${C.cards[3].name}`) }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(C.cards[3].question)).toBeInTheDocument()
    expect(within(dialog).getByText(C.cards[3].answer)).toBeInTheDocument()
    expect(within(dialog).getByText(C.flag.title)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: C.flag.action })).toHaveAttribute('href', '#flag-example')
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

  it('presents MCP as context transfer between FixFlags, AI, and verification', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = render(<CareHomepage />)
    expect(screen.getByRole('heading', { name: C.mcp.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.mcp.connect }))
    expect(await screen.findByText(C.mcp.copiedConnect)).toBeInTheDocument()
    expect(screen.getByText(C.mcp.connectBody)).toBeVisible()
    expect(writeText).toHaveBeenCalledWith(C.mcp.connectBody)
    for (const step of C.mcp.flow) {
      expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
    }
    expect(container.textContent).not.toMatch(/ff_[a-z_]+/)
    expect(container.textContent).not.toMatch(/MCP (watches|monitors)/i)
    expect(container.innerHTML).not.toMatch(/\/docs\/cli|\/docs\/mcp|\/help\/mcp-and-editors/)
  })

  it('uses the awareness promise and rejects the discarded broad copy', () => {
    const { container } = render(<CareHomepage />)
    expect(screen.getByText(/100\+ checks and real browser journeys/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: C.checks.title })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/More than uptime|One clear path from problem to proof|Keep what matters in view|over 200/i)
    expect(screen.getAllByText(C.quiet.notifications[2].title).length).toBeGreaterThan(0)
  })
})
