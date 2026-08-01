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

describe('AuditInput scan handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an in-flight submit button while the scan request is pending', async () => {
    startScanWithHandoff.mockReturnValue(new Promise(() => {}))
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-report-handoff" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByRole('button', { name: /Scanning/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeInTheDocument()
    expect(screen.queryByText(/Opening your report/i)).not.toBeInTheDocument()
  })

  it('returns to the URL field after a creation error without submitting again', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      message: 'Could not start this check.',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-report-error" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByText('Could not start this check.')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /Review my product/i })
    expect(retryButton).toBeEnabled()
    expect(startScanWithHandoff).toHaveBeenCalledOnce()

    fireEvent.click(retryButton)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(2))
  })

  it.each([
    ['hero', '-hero-validation'],
    ['final', '-final-validation'],
  ] as const)('validates empty and malformed URLs in the %s form', async (placement, idSuffix) => {
    render(
      <MeProvider initialUser={null}>
        <AuditInput
          variant="landing"
          ctaPlacement={placement}
          idSuffix={idSuffix}
        />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Enter a URL like https://yoursite.com')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'not a url' } })
    fireEvent.submit(input.closest('form')!)
    expect(
      await screen.findByText('Enter a valid URL like https://yoursite.com')
    ).toBeInTheDocument()
    expect(startScanWithHandoff).not.toHaveBeenCalled()
  })

  it.each([
    ['hero', '-hero-success'],
    ['final', '-final-success'],
  ] as const)('normalizes and hands off a valid URL from the %s form', async (placement, idSuffix) => {
    startScanWithHandoff.mockResolvedValue({
      ok: true,
      reportId: 'report-homepage-qa',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput
          variant="landing"
          ctaPlacement={placement}
          idSuffix={idSuffix}
        />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com/' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        body: expect.objectContaining({
          url: 'https://example.com',
          source: 'homepage',
        }),
      })
    )
  })
})
