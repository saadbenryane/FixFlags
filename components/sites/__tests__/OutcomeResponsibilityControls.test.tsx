import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutcomeEnabledControl } from '@/components/sites/OutcomeEnabledControl'
import { SafeFormFixtures } from '@/components/sites/SafeFormFixtures'

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
    const fetchMock = vi.fn().mockResolvedValue(respond({ outcome: { enabled: false } }))
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
      outcome: { enabled: true },
      verificationQueued: true,
    })))
    render(<OutcomeEnabledControl siteId="site-1" outcomeId="outcome-1" enabled={false} running={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enable Outcome' }))
    expect(await screen.findByText('Outcome enabled. Fresh verification started.')).toBeVisible()
  })

  it('saves only accessible target descriptors while keeping fixture secrets write-only', async () => {
    const saved = {
      id: 'fixture-1', name: 'Signup verification', targetUrl: 'https://example.com/signup',
      fieldMapping: {}, successCriterion: {}, resetUrl: 'https://example.com/reset',
      cleanupUrl: 'https://example.com/cleanup', version: 1, lastDryRunVersion: null,
      lastDryRunAt: null, lastDryRunResult: null, authorizedAt: null, enabled: true,
      hasValues: true, hasHookSecret: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(respond({ fixture: saved }, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<SafeFormFixtures siteId="site-1" initial={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Safe Form fixture' }))
    fireEvent.change(screen.getByLabelText('Signup page URL'), { target: { value: 'https://example.com/signup' } })
    fireEvent.change(screen.getByLabelText('Synthetic email'), { target: { value: 'robot@example.test' } })
    fireEvent.change(screen.getByLabelText('Synthetic password'), { target: { value: 'temporary-secret' } })
    fireEvent.change(screen.getByLabelText('Success text'), { target: { value: 'Check your inbox' } })
    fireEvent.change(screen.getByLabelText('Reset hook URL'), { target: { value: 'https://example.com/reset' } })
    fireEvent.change(screen.getByLabelText('Cleanup hook URL'), { target: { value: 'https://example.com/cleanup' } })
    fireEvent.change(screen.getByLabelText('Hook bearer secret'), { target: { value: 'hook-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save fixture' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(payload.fieldMapping).toEqual({
      fields: {
        email: { by: 'label', value: 'Email' },
        password: { by: 'label', value: 'Password' },
      },
      submit: { by: 'role', role: 'button', value: 'Create account' },
    })
    expect(JSON.stringify(payload)).not.toContain('selector')
    expect(payload.values).toEqual({ email: 'robot@example.test', password: 'temporary-secret' })
    expect(payload.hookSecret).toBe('hook-secret')
    expect(saved).not.toHaveProperty('values')
    expect(saved).not.toHaveProperty('hookSecret')
  })
})
