import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreRing } from '@/components/report/ScoreRing'

describe('ScoreRing', () => {
  it('centers pending dots and draws a brand loader arc while scoring', () => {
    const { container } = render(<ScoreRing score={null} pending />)

    expect(screen.getByLabelText('Score pending')).toBeInTheDocument()
    const dots = container.querySelectorAll('[aria-hidden] span.h-1.w-1')
    expect(dots).toHaveLength(3)
    expect(container.querySelector('style')?.textContent).toContain('ff-score-spin')
    const spinner = container.querySelector('svg.motion-safe\\:animate-\\[ff-score-spin_1\\.15s_linear_infinite\\]')
    expect(spinner).toBeTruthy()
  })

  it('shows the numeric score without a spinner when complete', () => {
    const { container } = render(<ScoreRing score={72} />)

    expect(screen.getByLabelText('Score 72')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(container.querySelector('style')).toBeNull()
  })
})
