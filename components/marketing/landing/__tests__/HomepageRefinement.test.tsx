import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorIntegrationsSection } from '@/components/marketing/landing/EditorIntegrationsSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { WhyBuildersChooseSection } from '@/components/marketing/landing/WhyBuildersChooseSection'

describe('homepage refinement sections', () => {
  it('shows a report-shaped finish plan instead of a decorative workflow image', () => {
    render(<WhyBuildersChooseSection />)

    expect(screen.getByText('Finish Plan')).toBeInTheDocument()
    expect(screen.getByText('Why it matters')).toBeInTheDocument()
    expect(screen.getByText('Fix prompt')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('merges the three rubrics into the how-it-works report demo', () => {
    render(<HowItWorksLoopSection />)

    const message = screen.getByRole('tab', { name: 'Message' })
    const experience = screen.getByRole('tab', { name: 'Experience' })

    expect(experience).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(message)
    expect(message).toHaveAttribute('aria-selected', 'true')
    expect(experience).toHaveAttribute('aria-selected', 'false')
  })

  it('shows one connected editor workflow without generated step artwork', () => {
    render(<EditorIntegrationsSection />)

    expect(screen.getByText('Product release review')).toBeInTheDocument()
    expect(screen.getByText('Release path verified')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
