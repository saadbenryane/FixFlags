import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VerifyOutcomeButton } from '../VerifyOutcomeButton'

const refresh = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}))

describe('VerifyOutcomeButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    refresh.mockClear()
  })

  it('shows the reason the server gave when Verify cannot start', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Sign in to verify this Outcome.', code: 'HTTP_401' }),
    })))

    render(<VerifyOutcomeButton siteId="site-1" outcomeId="outcome-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Sign in to verify this Outcome.')).toBeVisible()
    expect(screen.queryByText('Could not start this verification')).not.toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('says verification started only after the server accepts it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 202,
      json: async () => ({ runId: 'run-1', auditId: 'audit-1', outcomeIds: ['outcome-1'], reused: false }),
    })))

    render(<VerifyOutcomeButton siteId="site-1" outcomeId="outcome-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Verification started')).toBeVisible()
    expect(refresh).toHaveBeenCalled()
  })
  it('rejects an incomplete acceptance receipt without refreshing or claiming verification started', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ runId: 'run-1', reused: false }, { status: 202 })))
    render(<VerifyOutcomeButton siteId="site-1" outcomeId="outcome-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByText('FixFlags could not confirm this action. Refresh before trying again.')).toBeVisible()
    expect(screen.queryByText('Verification started')).not.toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('reports network interruption and preserves the Verify action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<VerifyOutcomeButton siteId="site-1" outcomeId="outcome-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('status')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('replays an uncertain submission with the same key rather than admitting a second verification', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('response interrupted')).mockResolvedValue(
      Response.json({ runId: 'run-1', auditId: 'audit-1', outcomeIds: ['outcome-1'], reused: true }, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<VerifyOutcomeButton siteId="site-1" outcomeId="outcome-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByText('Verification started')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].headers['Idempotency-Key']).toBe(fetchMock.mock.calls[0][1].headers['Idempotency-Key'])
  })
})
