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
      json: async () => ({ runId: 'run-1', reused: false }),
    })))

    render(<VerifyOutcomeButton siteId="site-1" outcomeId="outcome-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Verification started')).toBeVisible()
    expect(refresh).toHaveBeenCalled()
  })
})
