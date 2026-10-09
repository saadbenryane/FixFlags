import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteActivityPanel } from '../SiteActivityPanel'
import type { SiteActivity } from '@/lib/sites/activity'

const activity: SiteActivity = {
  state: 'partial', label: 'Some checks could not finish', pagesReached: 24,
  milestones: [{ label: 'Website reached', state: 'done' }, { label: 'Reviewing findings', state: 'pending' }],
  events: [{ label: 'Page captures recorded', at: '2026-10-07T12:00:00.000Z' }],
}
describe('visible check progress', () => {
  it('shows one answer and recovery, with pipeline detail only in Activity', () => {
    const { container } = render(<SiteActivityPanel activity={activity} disconnected={false}><p>Recorded results remain available.</p></SiteActivityPanel>)
    expect(screen.getByRole('status')).toHaveTextContent('Analysis incomplete')
    expect(screen.queryByText('Reached')).not.toBeInTheDocument()
    expect(screen.queryByText('24 pages reached')).not.toBeInTheDocument()
    expect(screen.getByText('Recorded results remain available.')).toBeVisible()
    expect(container.querySelector('details')).toBeNull()
    expect(screen.queryByText('Page captures recorded')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run details' }))
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByText('Page captures recorded')).toBeVisible()
    expect(screen.queryByText('Website reached: completed')).not.toBeInTheDocument()
    expect(screen.queryByText('24 pages reached')).not.toBeInTheDocument()
  })
  it('does not claim live activity when updates are disconnected', () => {
    render(<SiteActivityPanel activity={{ ...activity, state: 'running' }} disconnected />)
    expect(screen.getByRole('status')).toHaveTextContent('Updates disconnected')
    expect(screen.queryByText(': in progress')).not.toBeInTheDocument()
  })
  it('offers a direct fresh check for an incomplete review', () => {
    const onRetry = vi.fn(async () => {})
    render(<SiteActivityPanel activity={activity} disconnected={false} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Analysis incomplete')
  })
})
