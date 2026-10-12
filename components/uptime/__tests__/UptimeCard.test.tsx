import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UptimeCard } from '../UptimeCard'
import { uptimeTimeline, type UptimeHistory, type UptimeSummary } from '@/lib/uptime/domain'

const summary: UptimeSummary = { enabled: true, targetUrl: 'https://example.com/', state: 'unknown', lastCheckedAt: null,
  nextCheckAt: null, openIncidentCount: 0, segments: uptimeTimeline([], new Date('2026-10-12T12:00:00Z')) }
function history(window: UptimeHistory['window'] = '24h'): UptimeHistory {
  return { ...summary, segments: uptimeTimeline([], new Date('2026-10-12T12:00:00Z'), window), window, probes: [], incidents: [], nextCursor: null }
}
afterEach(() => vi.unstubAllGlobals())
describe('recorded uptime reporting', () => {
  it('leaves missing observations neutral and never invents an uptime percentage', () => {
    render(<UptimeCard siteId="site-1" summary={summary} />)
    const timeline = screen.getByRole('img')
    expect(timeline.children).toHaveLength(48)
    expect([...timeline.children].every(mark => mark.getAttribute('data-state') === 'unknown')).toBe(true)
    expect(screen.getByText('No checks recorded yet.')).toBeVisible()
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  })
  it('loads the requested history window and exposes recorded periods accessibly', async () => {
    const fetch = vi.fn(async (url: string) => {
      const window = new URL(url, 'http://localhost').searchParams.get('window') as UptimeHistory['window']
      return { ok: true, json: async () => ({ siteId: 'site-1', ...history(window) }) }
    })
    vi.stubGlobal('fetch', fetch)
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByText('Recorded periods')).toBeVisible())
    fireEvent.click(within(dialog).getByRole('button', { name: '7 days' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/sites/site-1/uptime?window=7d', expect.objectContaining({ cache: 'no-store' })))
    await waitFor(() => expect(dialog.querySelectorAll('details ul li')).toHaveLength(56))
    expect(within(dialog).getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('rejects another site’s response without displaying its history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ siteId: 'another-site', ...history() }) })))
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('History could not be loaded.'))
    expect(within(screen.getByRole('dialog')).queryByText('No incidents recorded in this period.')).not.toBeInTheDocument()
  })
})
