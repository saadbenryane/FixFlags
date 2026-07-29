import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.hoisted(() => vi.fn())
const useMe = vi.hoisted(() => vi.fn())
const claimAnonymous = vi.hoisted(() => vi.fn())
const trackEvent = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))
vi.mock('@/hooks/useMe', () => ({ useMe }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent }))
vi.mock('@/components/auth/AuthFlow', () => ({
  AuthFlow: ({
    nextPath,
    reportHostname,
    onAuthenticated,
  }: {
    nextPath: string
    reportHostname?: string | null
    onAuthenticated: () => Promise<void>
  }) => (
    <div>
      <span>{nextPath}</span>
      {reportHostname ? <span>{reportHostname}</span> : null}
      <button type="button" onClick={() => void onAuthenticated()}>
        Complete auth
      </button>
    </div>
  ),
}))

import { ReportAuthGate } from '@/components/auth/ReportAuthGate'

describe('ReportAuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    claimAnonymous.mockResolvedValue({ user: { id: 'u1' } })
    useMe.mockReturnValue({ user: null, claimAnonymous })
  })

  it('opens for an anonymous report and preserves the report return path', () => {
    render(
      <ReportAuthGate
        auditId="audit-1"
        required
        reportUrl="https://southernia.com/pricing"
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('/report/audit-1')).toBeInTheDocument()
    expect(screen.getByText('southernia.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Leave this report/i })).toHaveAttribute(
      'href',
      '/'
    )
    expect(trackEvent).toHaveBeenCalledWith('report_auth_gate_viewed', {
      audit_id: 'audit-1',
    })
  })

  it('does not dismiss on Escape', () => {
    render(<ReportAuthGate auditId="audit-1" required />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('claims before refreshing and records completion', async () => {
    render(<ReportAuthGate auditId="audit-1" required />)
    fireEvent.click(screen.getByRole('button', { name: 'Complete auth' }))

    await waitFor(() => expect(claimAnonymous).toHaveBeenCalledWith({ showToast: false }))
    expect(trackEvent).toHaveBeenCalledWith('report_auth_gate_completed', {
      audit_id: 'audit-1',
    })
    expect(trackEvent).toHaveBeenCalledWith('report_claimed', {
      audit_id: 'audit-1',
    })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('stays absent for signed-in viewers and reports that do not require it', () => {
    const { rerender } = render(<ReportAuthGate auditId="audit-1" required={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    useMe.mockReturnValue({ user: { id: 'u1' }, claimAnonymous })
    rerender(<ReportAuthGate auditId="audit-1" required />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
