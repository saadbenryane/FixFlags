import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'

describe('ScoreRingGauge', () => {
  it('renders the numeric score', () => {
    render(<ScoreRingGauge score={75} />)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Score 75 percent')
  })

  it('renders N/A for null score', () => {
    render(<ScoreRingGauge score={null} />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Score unavailable')
  })

  it('renders sm size with smaller text', () => {
    render(<ScoreRingGauge score={50} size="sm" />)
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('shows scanning label when loading without progress', () => {
    render(<ScoreRingGauge score={null} loading />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Scanning')
    expect(screen.getByRole('img')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows determinate progress when loading with progress', () => {
    render(<ScoreRingGauge score={null} loading progress={42} />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Scanning, 42 percent')
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('stays indeterminate at the QUEUED anchor instead of pinning a fake percent', () => {
    render(<ScoreRingGauge score={null} loading progress={5} />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Scanning')
    expect(screen.queryByText('5')).not.toBeInTheDocument()
  })

  it('shows empty center during indeterminate scan', () => {
    render(<ScoreRingGauge score={null} loading />)
    const centered = document.querySelector('.absolute.inset-0')
    expect(centered).toBeInTheDocument()
  })

  it('does not set aria-busy when not loading', () => {
    render(<ScoreRingGauge score={80} />)
    expect(screen.getByRole('img')).not.toHaveAttribute('aria-busy')
  })
})
