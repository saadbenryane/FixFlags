import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnalysisDetails, SiteAnalysisDetails } from '../AnalysisDetails'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SITE_WORKSPACE_COPY as C } from '@/lib/marketing/copy/workspace'

const props = { statusLabel: 'Analyzing', active: true, disconnected: false }

describe('website analysis details', () => {
  it('ages a completed check locally and exposes its exact recorded time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
    const view = siteViewFixture()
    view.presentation.run.state = 'idle'
    view.presentation.freshness = { checkedAt: '2026-11-03T12:00:00Z', label: 'just now', stale: false }
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const page = render(<SiteAnalysisDetails view={view} disconnected={false} />)
    try {
      expect(screen.getByText(/Last checked/)).toHaveTextContent(/just now/i)
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
      expect(screen.getByText(/Last checked/)).toHaveTextContent('2 min ago')
      const time = page.container.querySelector('time')
      expect(time).toHaveAttribute('datetime', '2026-11-03T12:00:00Z')
      expect(time).toHaveAttribute('title', 'Nov 3, 2026, 12:00 PM UTC')
      expect(fetch).not.toHaveBeenCalled()
    } finally { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() }
  })

  it('does not offer a read retry for a stream interruption alone', () => {
    render(<SiteAnalysisDetails view={siteViewFixture()} disconnected onRetry={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(C.disconnected)
    expect(screen.queryByRole('button', { name: C.retryUpdates })).not.toBeInTheDocument()
  })

  it('owns one explicit read retry and releases it after failure without dropping the recorded status', async () => {
    let fail!: (reason: Error) => void
    const retry = vi.fn(() => new Promise<void>((_resolve, reject) => { fail = reject }))
    render(<SiteAnalysisDetails view={siteViewFixture()} disconnected readUnavailable onRetry={retry} />)
    const button = screen.getByRole('button', { name: C.retryUpdates })
    fireEvent.click(button); fireEvent.click(button)
    expect(retry).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    await act(async () => { fail(new Error('Read unavailable')) })
    expect(button).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent(C.disconnected)
  })

  it.each(['Site change', 'view unmount'] as const)('does not move focus after a retired retry finishes following %s', async change => {
    let finish!: () => void
    const retry = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const view = (siteId: string, mounted = true) => {
      const initial = siteViewFixture()
      initial.site.siteId = siteId
      return <div data-site-content><h1 tabIndex={-1}>Current Site: {siteId}</h1>
        {mounted ? <SiteAnalysisDetails view={initial} disconnected readUnavailable onRetry={retry} /> : <p>Another workspace view</p>}
      </div>
    }
    const rendered = render(view('first'))
    const button = screen.getByRole('button', { name: C.retryUpdates })
    button.focus()
    fireEvent.click(button)
    expect(button).toBeDisabled()
    rendered.rerender(view(change === 'Site change' ? 'second' : 'first', change !== 'view unmount'))
    expect(document.body).toHaveFocus()
    await act(async () => { finish() })
    expect(document.body).toHaveFocus()
    if (change === 'Site change') expect(screen.getByRole('button', { name: C.retryUpdates })).toBeEnabled()
  })
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
