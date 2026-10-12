import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnalysisDetails } from '../AnalysisDetails'
import type { ExecutionProgress } from '@/lib/sites/application/execution-progress'

const props = { host: 'a-very-long-website-name.example.com', statusLabel: 'Analyzing', active: true, disconnected: false }
const progress: ExecutionProgress = { total: 2, completed: 1, running: 1, pending: 0, recovering: 0, unknown: 0, inapplicable: 0, recoveryUntil: null, eventCursor: null,
  tasks: [{ id: 'browser', kind: 'browser', pageUrl: 'https://example.com/', state: 'RUNNING', attempts: 1, reason: null, retryAt: null },
    { id: 'speed', kind: 'pagespeed', pageUrl: 'https://example.com/', state: 'COMPLETED', attempts: 1, reason: null, retryAt: null }] }
describe('website analysis details', () => {
  it('opens from the status before work records exist', () => {
    render(<AnalysisDetails {...props} />)
    expect(screen.getByRole('status').querySelector('svg')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Run details' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: props.host })).toBeVisible()
    expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('retains the open modal through completion and leaves technical records collapsed', () => {
    const view = render(<AnalysisDetails {...props} progress={progress} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run details' }))
    expect(screen.getByRole('dialog').querySelector('details')).not.toHaveAttribute('open')
    view.rerender(<AnalysisDetails {...props} statusLabel="Check finished" active={false} progress={{ ...progress, running: 0, completed: 2, tasks: progress.tasks.map(task => ({ ...task, state: 'COMPLETED' })) }} />)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(within(screen.getByRole('dialog')).getByText('Check finished')).toBeVisible()
  })
  it('stops the live spinner when updates disconnect', () => {
    render(<AnalysisDetails {...props} disconnected statusLabel="Updates disconnected" />)
    expect(screen.getByRole('status').querySelector('svg')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Run details' }))
    expect(within(screen.getByRole('dialog')).getByText('Updates disconnected. Your last recorded evidence is still shown.')).toBeVisible()
  })
  it('returns keyboard focus to the details control after closing', async () => {
    render(<AnalysisDetails {...props} progress={progress} />)
    const trigger = screen.getByRole('button', { name: 'Run details' })
    trigger.focus(); fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
  })

})
