import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MeProvider } from '@/hooks/useMe'

const startScanWithHandoff = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff,
  trackStartedAudit: vi.fn(),
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

import { AuditInput } from '@/components/audit/AuditInput'

describe('AuditInput report-first handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replaces the landing content with report geometry while creation is pending', async () => {
    startScanWithHandoff.mockReturnValue(new Promise(() => {}))
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByLabelText('Loading report')).toBeInTheDocument()
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Scanning in the background/i)).not.toBeInTheDocument()
  })

  it('returns to the URL field after a creation error without submitting again', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      message: 'Could not start this check.',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByText('Could not start this check.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading report')).not.toBeInTheDocument()
    expect(startScanWithHandoff).toHaveBeenCalledOnce()
  })
})
