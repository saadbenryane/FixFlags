import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CheckDimensionsSection } from '@/components/marketing/landing/CheckDimensionsSection'
import { WhyBuildersChooseSection } from '@/components/marketing/landing/WhyBuildersChooseSection'

describe('homepage refinement sections', () => {
  it('renders the complete supported-builder workflow', () => {
    render(<WhyBuildersChooseSection />)

    expect(screen.getByText('Works where you build')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /Review, fix, and re-check in your existing workflow/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: /Review, Flag, Fix, and Re-check.*cleared Flags.*improved release status.*confident shipping/i,
      })
    ).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('keeps all four release-readiness tabs keyboard-operable', () => {
    render(<CheckDimensionsSection />)

    const message = screen.getByRole('tab', { name: 'Message' })
    const experience = screen.getByRole('tab', { name: 'Experience' })

    fireEvent.click(experience)
    expect(experience).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', { name: 'Make every next step obvious.' })
    ).toBeInTheDocument()

    fireEvent.keyDown(experience, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Reach' })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Reach' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'All checks' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(message).toHaveAttribute('aria-selected', 'false')
  })
})
