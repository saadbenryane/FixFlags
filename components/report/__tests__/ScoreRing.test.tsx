import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreRing } from '@/components/report/ScoreRing'

describe('ScoreRing', () => {
  it('centers pending dots and draws a brand loader arc while scoring', () => {
    const { container } = render(<ScoreRing score={null} pending />)

    expect(screen.getByLabelText(/^Score pending/)).toBeInTheDocument()
    const dots = container.querySelectorAll('[aria-hidden] span.h-1.w-1')
    expect(dots).toHaveLength(3)
    const keyframes = container.querySelector('style')?.textContent ?? ''
    expect(keyframes).toContain('ff-score-spin')
    expect(keyframes).toContain('from { transform: rotate(0deg); }')
    expect(keyframes).toContain('to { transform: rotate(360deg); }')
    const spinner = container.querySelector('[data-score-spinner]')
    expect(spinner).toHaveClass('motion-safe:animate-[ff-score-spin_1.15s_linear_infinite]')
    expect(spinner).not.toHaveClass('-rotate-90')
    expect(spinner?.querySelector('circle')?.getAttribute('transform')).toBe('rotate(-90 32 32)')
    expect(spinner?.querySelector('circle')?.getAttribute('stroke-dasharray')).toBe('28 72')
  })

  it('shows the numeric score without a spinner when complete', () => {
    const { container } = render(<ScoreRing score={72} />)

    expect(screen.getByLabelText(/^Score 72/)).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(container.querySelector('style')).toBeNull()
    expect(container.querySelector('[data-score-spinner]')).toBeNull()
    expect(container.querySelector('circle[stroke-dasharray="72 100"]')?.getAttribute('transform')).toBe(
      'rotate(-90 32 32)'
    )
  })

  it('renders a compact ring for dense list rows', () => {
    const { container } = render(<ScoreRing score={65} size="sm" />)
    const ring = screen.getByLabelText(/^Score 65/)

    expect(ring).toHaveClass('h-9', 'w-9')
    expect(screen.getByText('65')).toHaveClass('text-2xs')
    expect(container.querySelector('style')).toBeNull()
  })
})
