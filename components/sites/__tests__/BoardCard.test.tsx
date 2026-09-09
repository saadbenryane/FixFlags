import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BoardCard, AddBoardCard } from '../BoardCard'
import { Globe2 } from 'lucide-react'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

describe('BoardCard chrome', () => {
  it('keeps healthy status accessible without repeating freshness on the board', () => {
    render(
      <BoardCard
        name="Security"
        status="Checks passed"
        state="healthy"
        answer="Protected"
        icon={Globe2}
        onOpen={() => undefined}
      />
    )
    expect(screen.queryByText(SITE_BOARD_COPY.lastChecked)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Security: Checks passed' })).toBeInTheDocument()
    expect(screen.queryByText('Checks passed')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
  })

  it('opens the same detail from a compact Flag count or the card', () => {
    const onOpen = vi.fn()
    render(
      <BoardCard
        name="Conversion"
        status="Needs a fix"
        state="problem"
        answer="No confirmation after contact"
        icon={Globe2}
        flags={[{ id: 'flag-1', title: 'No confirmation after contact', href: '#flag-example' }]}
        onOpen={onOpen}
      />
    )
    expect(screen.queryByText('Needs a fix')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Conversion: Needs a fix' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('renders Add card', () => {
    const onOpen = vi.fn()
    render(<AddBoardCard onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.addCard }))
    expect(onOpen).toHaveBeenCalled()
  })
})
