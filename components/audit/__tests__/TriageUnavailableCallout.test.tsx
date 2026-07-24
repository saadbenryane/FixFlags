import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TriageUnavailableCallout } from '@/components/audit/TriageUnavailableCallout'
import { AUDIT_ERRORS, REPORT_COPY } from '@/lib/marketing/copy'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('TriageUnavailableCallout', () => {
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
