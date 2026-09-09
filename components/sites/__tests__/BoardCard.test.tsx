import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BoardCard, AddBoardCard } from '../BoardCard'
import { Globe2 } from 'lucide-react'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

describe('BoardCard chrome', () => {
  it('shows Last checked beside a green signal and hides status slogans', () => {
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
    expect(screen.getByText(SITE_BOARD_COPY.lastChecked)).toBeInTheDocument()
    expect(screen.queryByText('Checks passed')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
  })

  it('keeps Flag chips clickable without opening the card', () => {
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
    fireEvent.click(screen.getByRole('link', { name: /No confirmation after contact/ }))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders Add card', () => {
    const onOpen = vi.fn()
    render(<AddBoardCard onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.addCard }))
    expect(onOpen).toHaveBeenCalled()
  })
})
