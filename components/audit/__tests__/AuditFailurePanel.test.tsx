import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'

describe('AuditFailurePanel', () => {
  it('announces the failure as an alert with the shared title', () => {
    render(<AuditFailurePanel failureCode="AUDIT_TIMEOUT" />)
    expect(screen.getByRole('alert')).toHaveTextContent(AUDIT_ERRORS.checkFailedTitle)
  })

  it('maps known failure codes to user-safe copy', () => {
    render(<AuditFailurePanel failureCode="AUDIT_TIMEOUT" />)
    expect(screen.getByText(AUDIT_ERRORS.timeout)).toBeInTheDocument()
  })

  it('never leaks unknown failure codes to the user', () => {
    render(<AuditFailurePanel failureCode="SOME_INTERNAL_EXPLOSION" />)
    expect(screen.getByText(AUDIT_ERRORS.generic)).toBeInTheDocument()
    expect(screen.queryByText(/SOME_INTERNAL_EXPLOSION/)).not.toBeInTheDocument()
  })

  it('offers retry only when a handler is provided, and fires it', () => {
    const { rerender } = render(<AuditFailurePanel failureCode="AUDIT_TIMEOUT" />)
    expect(
      screen.queryByRole('button', { name: AUDIT_ERRORS.retryCta })
    ).not.toBeInTheDocument()

    const onRetry = vi.fn().mockResolvedValue(undefined)
    rerender(<AuditFailurePanel failureCode="AUDIT_TIMEOUT" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: AUDIT_ERRORS.retryCta }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables the retry button while a retry is in flight', () => {
    render(
      <AuditFailurePanel
        failureCode="AUDIT_TIMEOUT"
        onRetry={vi.fn().mockResolvedValue(undefined)}
        retryLoading
      />
    )
    expect(screen.getByRole('button', { name: AUDIT_ERRORS.retryCta })).toBeDisabled()
  })
})
