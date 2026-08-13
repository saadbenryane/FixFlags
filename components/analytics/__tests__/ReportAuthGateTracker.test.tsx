import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportAuthGateTracker } from '@/components/analytics/ReportAuthGateTracker'

const trackEvent = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics/events', () => ({
  trackEvent,
}))

describe('ReportAuthGateTracker', () => {
  afterEach(() => {
    window.sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('tracks report auth gate viewed when the gate is shown', async () => {
    render(<ReportAuthGateTracker auditId="audit-123" gateShown />)

    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(1))
    expect(trackEvent).toHaveBeenCalledWith('report_auth_gate_viewed', {
      audit_id: 'audit-123',
    })
  })

  it('tracks report auth gate completed when previously viewed gate is resolved', async () => {
    const { rerender } = render(<ReportAuthGateTracker auditId="audit-456" gateShown />)
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith('report_auth_gate_viewed', {
        audit_id: 'audit-456',
      }),
    )

    vi.mocked(trackEvent).mockClear()
    rerender(<ReportAuthGateTracker auditId="audit-456" gateShown={false} />)

    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(1))
    expect(trackEvent).toHaveBeenCalledWith('report_auth_gate_completed', {
      audit_id: 'audit-456',
    })
  })

  it('does not track when disabled', async () => {
    render(<ReportAuthGateTracker auditId="audit-789" gateShown enabled={false} />)

    await waitFor(() => expect(trackEvent).not.toHaveBeenCalled())
  })
})
