import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OutcomeBindingResult } from '@/components/sites/OutcomeBindingResult'
import { summaryFor } from '@/lib/sites/application/binding-assessment'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'

describe('Outcome binding result', () => {
  it('states a blocked Checkout in customer language', () => {
    const copy = checkoutResultCopy('no_buy_control')
    render(
      <OutcomeBindingResult
        bindingKey="checkout-browser-v1"
        disposition="BLOCKED"
        reason="no_buy_control"
      />,
    )
    expect(screen.getByText(copy.summary)).toBeVisible()
    expect(screen.getByText(copy.evidence)).toBeVisible()
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument()
    expect(screen.queryByText('No buy control')).not.toBeInTheDocument()
  })

  it('states a successful Checkout as a completed purchase', () => {
    const copy = checkoutResultCopy('checkout_reached')
    render(
      <OutcomeBindingResult
        bindingKey="checkout-browser-v1"
        disposition="SUCCEEDED"
        reason="checkout_reached"
      />,
    )
    expect(screen.getByText(copy.summary)).toBeVisible()
    expect(screen.getByText(copy.evidence)).toBeVisible()
  })

  it('states a protected Signup without a reason code', () => {
    render(
      <OutcomeBindingResult
        bindingKey="signup-safe-form-v1"
        disposition="BLOCKED"
        reason="protected_or_irreversible"
      />,
    )
    expect(screen.getByText(summaryFor('protected_or_irreversible', 'COULD_NOT_VERIFY'))).toBeVisible()
    expect(screen.queryByText('Protected or irreversible')).not.toBeInTheDocument()
  })

  it('states an unavailable page without a reason code', () => {
    render(
      <OutcomeBindingResult
        bindingKey="page-availability-v1"
        disposition="FAILED"
        reason="http_unavailable"
      />,
    )
    expect(screen.getByText(summaryFor('http_unavailable', 'FLAG'))).toBeVisible()
    expect(screen.queryByText('Http unavailable')).not.toBeInTheDocument()
  })
})
