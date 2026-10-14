import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SitePreviewCard, type SiteCapture } from '../SitePreviewCard'

const captures: SiteCapture[] = [
  { auditId: 'old', url: '/api/screenshots/old/desktop', pageUrl: 'https://example.com/', device: 'desktop', previous: true, viewport: '1280 × 720', recordedAt: null },
  { auditId: 'current', url: '/api/screenshots/current/mobile', pageUrl: 'https://example.com/', device: 'mobile', previous: false, viewport: '390 × 844', recordedAt: '2026-10-12T12:00:00.000Z' },
]
describe('website capture preview', () => {
  it('uses the selected capture and its provenance, then restores focus after enlargement', async () => {
    const view = render(<SitePreviewCard host="example.com" captures={captures} />)
    expect(screen.queryByRole('heading', { name: 'Website preview' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Mobile' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Desktop' }).textContent).toBe('')
    expect(screen.queryByText(/Previous capture/)).not.toBeInTheDocument()
    expect(screen.queryByText('https://example.com/')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open captured page for example.com' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Previous capture')
    expect(screen.getByRole('dialog')).toHaveTextContent('Capture time unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }))
    expect(screen.getByRole('button', { name: 'Mobile' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute('aria-pressed', 'false')
    expect(view.container.querySelector('img')).toHaveAttribute('src', captures[1].url)
    expect(view.container.querySelector('img')).toHaveAttribute('width', '390')
    expect(view.container.querySelector('img')).toHaveAttribute('height', '844')
    expect(screen.queryByText(/Latest capture/)).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Open captured page for example.com' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toHaveTextContent('Latest capture')
    expect(screen.getByRole('dialog')).toHaveTextContent('390 × 844')
    expect(screen.getByRole('dialog')).toHaveTextContent('https://example.com/')
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', captures[1].url)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('does not substitute desktop evidence for a missing mobile capture', () => {
    const view = render(<SitePreviewCard host="example.com" captures={[captures[0]]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }))
    expect(screen.getByText('No screenshot yet')).toBeVisible()
    expect(view.container.querySelector('img')).toBeNull()
  })
  it('shows failed image loading honestly instead of offering an empty enlargement', () => {
    const view = render(<SitePreviewCard host="example.com" captures={captures} />)
    fireEvent.error(view.container.querySelector('img')!)
    expect(screen.getByText('Screenshot unavailable')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open captured page for example.com' })).not.toBeInTheDocument()
  })
})
