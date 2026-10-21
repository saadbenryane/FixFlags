import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { BoardCard, ProductBoardCard } from '../BoardCard'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import type { BoardCardView } from '@/lib/sites/board-card'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

describe('BoardCard chrome', () => {
  it('hydrates recorded freshness even when the browser arrives after a minute boundary', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-19T12:00:59Z'))
    const element = <BoardCard name="Search" status="Not checked yet" state="unknown" answer="Recorded checks"
      icon="search" layout="row" checkedAt="2026-10-19T12:00:00Z" onOpen={() => undefined} />
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = renderToString(element)
    const serverText = container.textContent
    now.mockReturnValue(Date.parse('2026-10-19T12:02:01Z'))
    const errors: unknown[] = []
    let root: Root | undefined
    try {
      await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: error => errors.push(error) }) })
      expect(errors).toEqual([])
      expect(container.textContent).toBe(serverText)
    } finally {
      await act(async () => root?.unmount())
      container.remove()
      now.mockRestore()
    }
  })

  it('states an identical coverage limitation once while preserving recovery', () => {
    render(<BoardCard name="Security" icon="security" status="Not checked yet" state="unknown" answer="Some checks unfinished"
      detail="Some checks unfinished" incompleteReason="Some checks unfinished" layout="row"
      recoveryAction={<button>Check Security again</button>} />)
    expect(screen.getAllByText('Some checks unfinished')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Check Security again' })).toBeVisible()
  })
  it('shows unfinished work and a separate recovery action alongside recorded Flags', () => {
    const retry = vi.fn()
    render(<BoardCard name="Search" status="1 Flag" state="problem" answer="Page title is missing" icon="search"
      layout="row" flags={[{ id: 'f1', title: 'Page title is missing', href: '#flag' }]}
      incompleteReason="Unfinished checks: Crawl access." recoveryAction={<button onClick={retry}>Check Search again</button>} />)
    expect(screen.getByRole('link', { name: 'Page title is missing' })).toBeVisible()
    expect(screen.getByText('Unfinished checks: Crawl access.')).toBeVisible()
    const action = screen.getByRole('button', { name: 'Check Search again' })
    expect(action.parentElement?.closest('button, a')).toBeNull()
    fireEvent.click(action)
    expect(retry).toHaveBeenCalledOnce()
  })

  it('names guidance that is still being written without offering it for copy', () => {
    render(<BoardCard name="Search" status="2 Flags" state="problem" answer="Page title is missing" icon="search" layout="row" flags={[
      { id: 'pending', title: 'Page title is missing', href: '#pending', repairGuidance: 'pending' },
      { id: 'ready', title: 'Ready finding', href: '#ready', repairGuidance: 'ready', copyAction: <button type="button">Copy fix prompt</button> },
    ]} />)
    expect(screen.getByText(SITE_ACTION_COPY.repairGuidance.label.pending)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ready finding' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Copy fix prompt' })).toHaveLength(1)
  })

  it('keeps healthy status accessible without repeating freshness on the board', () => {
    render(
      <BoardCard
        name="Security"
        status="Checks passed"
        state="healthy"
        answer="Protected"
        icon="site"
        onOpen={() => undefined}
      />
    )
    expect(screen.queryByText(SITE_BOARD_COPY.lastChecked)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Security' })).toBeInTheDocument()
    expect(screen.queryByText('Checks passed')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
  })

  it('opens detail from one predictable card target', () => {
    const onOpen = vi.fn()
    render(
      <BoardCard
        name="Conversion"
        status="Needs a fix"
        state="problem"
        answer="No confirmation after contact"
        icon="site"
        flags={[{ id: 'flag-1', title: 'No confirmation after contact', href: '#flag-example' }]}
        onOpen={onOpen}
      />
    )
    expect(screen.queryByText('Needs a fix')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders the opt-in homepage Flag preview without duplicating the count', () => {
    render(
      <BoardCard
        name="Conversion"
        status="5 Flags"
        state="problem"
        answer="Checkout stopped working"
        icon="conversion"
        flags={Array.from({ length: 5 }, (_, index) => ({ id: `flag-${index}`, title: `Flag ${index + 1}`, href: `#flag-${index}` }))}
        onOpen={() => undefined}
        showFlagPreview
      />
    )

    expect(screen.getByText('5 Flags')).toBeInTheDocument()
    expect(screen.getAllByText('5 Flags')).toHaveLength(1)
    expect(screen.getByText('Flag 1')).toBeInTheDocument()
    expect(screen.getByText('Flag 2')).toBeInTheDocument()
    expect(screen.queryByText('Flag 3')).not.toBeInTheDocument()
    expect(screen.getByText('+3 more')).toBeInTheDocument()
  })

  it('lists every row Flag as its own action', () => {
    const openFirst = vi.fn()
    const openCard = vi.fn()
    render(
      <BoardCard
        name="Pages"
        status="2 Flags"
        state="problem"
        answer="Pages need attention"
        icon="site"
        flags={[
          { id: 'pricing', title: 'Pricing page is unavailable', href: '#pricing', onOpen: openFirst },
          { id: 'contact', title: 'Contact page returns an error', href: '#contact' },
        ]}
        flagCount={2}
        onOpen={openCard}
        layout="row"
      />
    )

    expect(screen.getByText('2 Flags')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pricing page is unavailable' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Contact page returns an error' })).toHaveAttribute('href', '#contact')
    fireEvent.click(screen.getByRole('button', { name: 'Pricing page is unavailable' }))
    expect(openFirst).toHaveBeenCalledOnce()
    expect(openCard).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Pages: 2 Flags' }))
    expect(openCard).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Open Pricing page is unavailable' }))
    expect(openFirst).toHaveBeenCalledTimes(2)
  })

  it('shows up to three Flag titles and uses Clear instead of 0 Flags', () => {
    const { rerender } = render(
      <BoardCard
        name="Pages"
        status="3 Flags"
        state="problem"
        answer="Pages have Flags"
        icon="site"
        flags={Array.from({ length: 3 }, (_, index) => ({ id: `flag-${index}`, title: `Page Flag ${index + 1}`, href: `#flag-${index}` }))}
        onOpen={() => undefined}
        showFlagPreview
      />
    )
    expect(screen.getByText('Page Flag 3')).toBeInTheDocument()

    rerender(
      <BoardCard
        name="Security"
        status="Clear"
        state="healthy"
        answer="HTTPS protections checked"
        icon="security"
        onOpen={() => undefined}
        showFlagPreview
      />
    )
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
  })

  it.each(['Partial', 'Out of date', 'Not configured'])('preserves %s instead of implying a passing count', status => {
    render(<BoardCard name="Performance" status={status} state="unknown" answer="No current measurement" icon="performance" onOpen={() => undefined} />)
    expect(screen.getByText(status)).toBeVisible()
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
    expect(screen.queryByText('Clear')).not.toBeInTheDocument()
  })

  it('keeps the overview concise without modifying the underlying finding', () => {
    const title = 'Primary CTA is hidden below the fold on mobile'
    const card: BoardCardView = {
      id: 'conversion', name: 'Conversion', question: 'Can visitors continue?', state: 'problem', status: 'Needs a fix',
      answer: title, detail: 'Long explanation of the finding.', facts: [], coverage: 'Mobile only', evidenced: true,
      openFlagCount: 1, checkedAt: null, flagIds: ['f1'], flagChips: [{ id: 'f1', title, href: '#f1' }], sources: [],
      activity: null, wide: false, captureUrl: null, captureAlt: null, cropUrl: null, cropAlt: null,
      problem: { title, body: 'Long explanation of the finding.', outcomeName: null, href: '#f1', actionLabel: 'Open' },
    }
    const onOpen = vi.fn()
    render(<ProductBoardCard card={card} compact onOpen={onOpen} />)
    expect(screen.getByText('Main button off-screen on mobile')).toBeVisible()
    expect(screen.queryByText('Long explanation of the finding.')).not.toBeInTheDocument()
    expect(card.answer).toBe(title)
    expect(card.problem?.body).toBe('Long explanation of the finding.')
    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })
})
