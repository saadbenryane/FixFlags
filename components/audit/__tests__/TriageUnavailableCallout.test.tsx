import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TriageUnavailableCallout } from '@/components/audit/TriageUnavailableCallout'
import { AUDIT_ERRORS, REPORT_COPY, SITE_ACTION_COPY } from '@/lib/marketing/copy-barrel'

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), toast: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }))
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('TriageUnavailableCallout', () => {
  it('opens a confirmed replacement report after retrying the written summary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'QUEUED', auditId: 'replacement' }) }))
    render(<TriageUnavailableCallout auditId="a1" isLoggedIn canRetry signUpHref="/sign-up" />)
    fireEvent.click(screen.getByRole('button', { name: REPORT_COPY.triageUnavailable.retryCta }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/report/replacement'))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('does not navigate when retry admission omits the new report identity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'QUEUED' }) }))
    render(<TriageUnavailableCallout auditId="a1" isLoggedIn canRetry signUpHref="/sign-up" />)
    fireEvent.click(screen.getByRole('button', { name: REPORT_COPY.triageUnavailable.retryCta }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(SITE_ACTION_COPY.invalidResponse))
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it('shows anonymous body and signup CTA, never partialReport', () => {
    render(
      <TriageUnavailableCallout
        auditId="a1"
        failureCode="AUDIT_PIPELINE_FAILED"
        isLoggedIn={false}
        canRetry={false}
        signUpHref="/sign-up?next=/report/a1"
      />
    )
    expect(screen.getByText(REPORT_COPY.triageUnavailable.title)).toBeInTheDocument()
    expect(screen.getByText(AUDIT_ERRORS.triageDegradedAnonymous)).toBeInTheDocument()
    expect(screen.queryByText(AUDIT_ERRORS.partialReport)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: REPORT_COPY.triageUnavailable.signupCta })).toHaveAttribute(
      'href',
      '/sign-up?next=/report/a1'
    )
  })

  it('shows signed-in body and retry for owners', () => {
    render(
      <TriageUnavailableCallout
        auditId="a1"
        failureCode={null}
        isLoggedIn
        canRetry
        signUpHref="/sign-up"
      />
    )
    expect(screen.getByText(AUDIT_ERRORS.triageDegradedSignedIn)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: REPORT_COPY.triageUnavailable.retryCta })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: REPORT_COPY.triageUnavailable.signupCta })).not.toBeInTheDocument()
  })

  it('uses timeout copy when failureCode is AUDIT_TIMEOUT', () => {
    render(
      <TriageUnavailableCallout
        auditId="a1"
        failureCode="AUDIT_TIMEOUT"
        isLoggedIn={false}
        canRetry={false}
        signUpHref="/sign-up"
      />
    )
    expect(screen.getByText(AUDIT_ERRORS.triageDegradedTimeout)).toBeInTheDocument()
  })
})
