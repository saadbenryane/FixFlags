import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnalysisDetails } from '../AnalysisDetails'

const props = { statusLabel: 'Analyzing', active: true, disconnected: false }

describe('website analysis details', () => {
  it('shows a live status without a check catalog', () => {
    render(<AnalysisDetails {...props} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Analyzing')
    expect(status.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Run details' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hides the status once the run is finished', () => {
    const view = render(<AnalysisDetails {...props} />)
    view.rerender(<AnalysisDetails {...props} statusLabel="Check finished" active={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Check finished')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps a disconnected update visible without a spinner', () => {
    render(<AnalysisDetails {...props} disconnected statusLabel="Updates disconnected" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Updates disconnected')
    expect(status.querySelector('svg')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Run details' })).not.toBeInTheDocument()
  })
})
