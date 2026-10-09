import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BoardCard, ProductBoardCard } from '../BoardCard'
import type { BoardCardView } from '@/lib/sites/board-card'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

describe('BoardCard chrome', () => {
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
