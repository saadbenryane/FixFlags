import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadyToVerifyButton } from '@/components/audit/ReadyToVerifyButton'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ attempt: { id: 'attempt-1' } }) })
  vi.stubGlobal('fetch', fetchMock)
})

describe('ReadyToVerifyButton', () => {
  it('announces and relates a missing change summary', () => {
    render(<ReadyToVerifyButton flagId="flag-1" builder="web" />)
    fireEvent.click(screen.getByRole('button', { name: /ready to verify/i }))

    const summary = screen.getByLabelText('What changed?')
    fireEvent.click(screen.getByRole('button', { name: /mark ready/i }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Describe the implemented change')
    expect(summary).toHaveAttribute('aria-invalid', 'true')
    expect(summary).toHaveAttribute('aria-describedby', alert.id)
  })

  it('uses programmatic labels and submits an honest builder declaration', async () => {
    render(<ReadyToVerifyButton flagId="flag-1" builder="web" />)

    fireEvent.click(screen.getByRole('button', { name: /ready to verify/i }))
    const summary = screen.getByLabelText('What changed?')
    const deployment = screen.getByLabelText(/Deployment reference/i)
    fireEvent.change(summary, { target: { value: 'Restored the signup action.' } })
    fireEvent.change(deployment, { target: { value: 'deploy-42' } })
    fireEvent.click(screen.getByRole('button', { name: /mark ready/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/flags/flag-1/attempts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          builder: 'web',
          action: 'READY_TO_VERIFY',
          changeSummary: 'Restored the signup action.',
          deploymentReference: 'deploy-42',
        }),
      })
    ))
  })
})
