import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ReportNotFoundStatus,
  ReportAccessDeniedStatus,
  ReportPollErrorStatus,
} from '@/components/ui/status-page'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'

describe('ReportNotFoundStatus', () => {
  it('renders the not-found copy with a way back to the product', () => {
    render(<ReportNotFoundStatus />)
    expect(
      screen.getByRole('heading', { level: 1, name: AUDIT_ERRORS.reportNotFoundTitle })
    ).toBeInTheDocument()
    expect(screen.getByText(AUDIT_ERRORS.reportNotFoundBody)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: AUDIT_ERRORS.startCheck })).toHaveAttribute(
      'href',
      '/'
    )
  })
})

describe('ReportAccessDeniedStatus', () => {
  it('renders the default denied copy', () => {
    render(<ReportAccessDeniedStatus />)
    expect(
      screen.getByRole('heading', { level: 1, name: AUDIT_ERRORS.accessDeniedTitle })
    ).toBeInTheDocument()
    expect(screen.getByText(AUDIT_ERRORS.accessDeniedBody)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: AUDIT_ERRORS.goHome })).toHaveAttribute('href', '/')
  })

  it('prefers a caller-supplied description', () => {
    render(<ReportAccessDeniedStatus description="This link expired." />)
    expect(screen.getByText('This link expired.')).toBeInTheDocument()
    expect(screen.queryByText(AUDIT_ERRORS.accessDeniedBody)).not.toBeInTheDocument()
  })
})

describe('ReportPollErrorStatus', () => {
  it('renders the poll-error copy and fires the retry callback', () => {
    const onRetry = vi.fn()
    render(<ReportPollErrorStatus onRetry={onRetry} />)
    expect(
      screen.getByRole('heading', { level: 1, name: AUDIT_ERRORS.pollErrorTitle })
    ).toBeInTheDocument()
    expect(screen.getByText(AUDIT_ERRORS.pollErrorBody)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: AUDIT_ERRORS.goHome })).toHaveAttribute('href', '/')
  })

  it('omits the retry action when no callback is given', () => {
    render(<ReportPollErrorStatus />)
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
