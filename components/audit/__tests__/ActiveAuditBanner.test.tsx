import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLayoutEffect } from 'react'
import { CLIENT_REQUEST_TIMEOUT_MS } from '@/lib/api/client-request'

const usePathname = vi.hoisted(() => vi.fn())
const useActiveAudit = vi.hoisted(() => vi.fn())
const dismiss = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ usePathname }))
vi.mock('@/hooks/useActiveAudit', () => ({ useActiveAudit }))

import { ActiveAuditBanner } from '@/components/audit/ActiveAuditBanner'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(finish => { resolve = finish })
  return { promise, resolve }
}

describe('ActiveAuditBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useActiveAudit.mockReturnValue({
      active: {
        auditId: 'audit-1',
        siteId: 'site-1',
      },
      dismiss,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'CHECKING', url: 'https://southernia.com', siteId: 'site-1' }),
    }))
    usePathname.mockReturnValue('/dashboard')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('never renders on the active Site board itself', () => {
    usePathname.mockReturnValue('/sites/site-1')

    render(<ActiveAuditBanner />)

    expect(screen.queryByText('Return to Site')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('derives the hostname from the authorized status response', async () => {
    usePathname.mockReturnValue('/')

    render(<ActiveAuditBanner />)

    expect(await screen.findByText('southernia.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to Site' })).toHaveAttribute(
      'href',
      '/sites/site-1'
    )
  })

  it.each(['CHECKING', 'COMPLETED'])('ignores a retired check body reporting %s', async status => {
    const oldBody = deferred<unknown>()
    const currentBody = deferred<unknown>()
    const oldJson = vi.fn(() => oldBody.promise)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: oldJson })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => currentBody.promise })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<ActiveAuditBanner />)
    await act(async () => {})
    expect(oldJson).toHaveBeenCalledOnce()
    const previousSignal = fetchMock.mock.calls[0][1].signal as AbortSignal

    useActiveAudit.mockReturnValue({ active: { auditId: 'audit-2', siteId: 'site-2' }, dismiss })
    view.rerender(<ActiveAuditBanner />)
    expect(previousSignal.aborted).toBe(true)
    await act(async () => { oldBody.resolve({ status, url: 'https://previous.example', siteId: 'site-1' }) })

    expect(dismiss).not.toHaveBeenCalled()
    expect(screen.queryByText('previous.example')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to Site' })).toHaveAttribute('href', '/sites/site-2')
    await act(async () => { currentBody.resolve({ status: 'CHECKING', url: 'https://current.example', siteId: 'site-2' }) })
    expect(screen.getByText('current.example')).toBeInTheDocument()
  })

  it('does not commit the previous hostname under a newly active check', async () => {
    const currentBody = deferred<unknown>()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'CHECKING', url: 'https://previous.example', siteId: 'site-1' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => currentBody.promise }))
    const committed: string[] = []
    function Workspace({ revision }: { revision: number }) {
      useLayoutEffect(() => { committed.push(document.body.textContent ?? '') }, [revision])
      return <ActiveAuditBanner />
    }
    const view = render(<Workspace revision={1} />)
    expect(await screen.findByText('previous.example')).toBeInTheDocument()
    useActiveAudit.mockReturnValue({ active: { auditId: 'audit-2', siteId: 'site-2' }, dismiss })
    view.rerender(<Workspace revision={2} />)
    expect(committed.at(-1)).not.toContain('previous.example')
    expect(screen.getByRole('link', { name: 'Return to Site' })).toHaveAttribute('href', '/sites/site-2')
  })

  it('keeps the current read when storage supplies the same active check again', async () => {
    const body = deferred<unknown>()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => body.promise })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<ActiveAuditBanner />)
    await act(async () => {})
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    useActiveAudit.mockReturnValue({ active: { auditId: 'audit-1', siteId: 'site-1' }, dismiss })
    view.rerender(<ActiveAuditBanner />)
    expect(signal.aborted).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
    await act(async () => { body.resolve({ status: 'CHECKING', url: 'https://current.example', siteId: 'site-1' }) })
    expect(screen.getByText('current.example')).toBeInTheDocument()
  })

  it('retires the banner read when the customer returns to its Site', async () => {
    const body = deferred<unknown>()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => body.promise })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<ActiveAuditBanner />)
    await act(async () => {})
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    usePathname.mockReturnValue('/sites/site-1')
    view.rerender(<ActiveAuditBanner />)
    expect(signal.aborted).toBe(true)
    await act(async () => { body.resolve({ status: 'COMPLETED', url: 'https://current.example', siteId: 'site-1' }) })
    expect(dismiss).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Return to Site' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each(['connection', 'body'])('continues checking after a stalled %s reaches its deadline', async stalled => {
    vi.useFakeTimers()
    const pending = deferred<unknown>()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => stalled === 'connection' ? pending.promise : Promise.resolve({ ok: true, status: 200, json: () => pending.promise }))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'CHECKING', url: 'https://current.example', siteId: 'site-1' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'COMPLETED', url: 'https://current.example', siteId: 'site-1' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<ActiveAuditBanner />)
    await act(async () => {})
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    await act(async () => { await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS) })
    expect(signal.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText('current.example')).toBeInTheDocument()
    expect(dismiss).not.toHaveBeenCalled()
    await act(async () => {
      const obsolete = { status: 'COMPLETED', url: 'https://previous.example', siteId: 'site-1' }
      pending.resolve(stalled === 'connection' ? { ok: true, status: 200, json: async () => obsolete } : obsolete)
    })
    expect(screen.getByText('current.example')).toBeInTheDocument()
    expect(dismiss).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(dismiss).toHaveBeenCalledExactlyOnceWith('audit-1')
    expect(screen.queryByRole('link', { name: 'Return to Site' })).not.toBeInTheDocument()
  })
})
