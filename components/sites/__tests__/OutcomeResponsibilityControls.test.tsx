import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutcomeEnabledControl } from '@/components/sites/OutcomeEnabledControl'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

function respond(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

describe('Outcome responsibility controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pauses through the narrow enabled contract and explains that an active run finishes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ outcome: { id: 'outcome-1', enabled: false }, verificationQueued: false, verificationError: null }))
    vi.stubGlobal('fetch', fetchMock)
    render(<OutcomeEnabledControl siteId="site-1" outcomeId="outcome-1" enabled running />)

    fireEvent.click(screen.getByRole('button', { name: 'Pause Outcome' }))
    await screen.findByText('Paused. The active verification will finish.')

    expect(fetchMock).toHaveBeenCalledWith('/api/sites/site-1/outcomes/outcome-1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    }))
    expect(refresh).toHaveBeenCalled()
  })

  it('reports whether re-enabling queued the required fresh verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({
      outcome: { id: 'outcome-1', enabled: true },
      verificationQueued: true,
      verificationError: null,
    })))
    render(<OutcomeEnabledControl siteId="site-1" outcomeId="outcome-1" enabled={false} running={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enable Outcome' }))
    expect(await screen.findByText('Outcome enabled. Fresh verification started.')).toBeVisible()
  })

  it.each([
    { id: 'another-outcome', enabled: false },
    { id: 'outcome-1', enabled: true },
  ])('does not acknowledge a mismatched pause receipt: %j', async outcome => {
    const accepted = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ outcome, verificationQueued: false, verificationError: null })))
    render(<OutcomeEnabledControl siteId="site-1" outcomeId="outcome-1" enabled running={false} onAccepted={accepted} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause Outcome' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('FixFlags could not confirm this action.')
    expect(accepted).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pause Outcome' })).toBeEnabled()
  })
})
