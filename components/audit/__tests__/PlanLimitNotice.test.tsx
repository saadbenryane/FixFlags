import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlanLimitNotice } from '@/components/audit/PlanLimitNotice'
import { PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy'

describe('PlanLimitNotice', () => {
  it.each(['site-limit', 'check-limit', 'claim-limit'] as const)(
    'gives %s one explanation and one action',
    (kind) => {
      render(<PlanLimitNotice kind={kind} />)

      expect(screen.getByText(PLAN_LIMIT_NOTICE.copy[kind].title)).toBeInTheDocument()
      expect(screen.getByText(PLAN_LIMIT_NOTICE.copy[kind].body)).toBeInTheDocument()
      // Exactly one primary action, and it goes somewhere.
      const actions = screen.getAllByRole('link')
      expect(actions).toHaveLength(1)
      expect(actions[0]).toHaveAttribute('href', '/pricing')
    }
  )

  it('shows the API detail when the response states the concrete capacity', () => {
    render(<PlanLimitNotice kind="claim-limit" message="Your plan supports 1 Product." />)

    expect(screen.getByText('Your plan supports 1 Product.')).toBeInTheDocument()
  })

  it('omits the dismiss control when no dismiss handler is given', () => {
    render(<PlanLimitNotice kind="site-limit" />)

    expect(
      screen.queryByRole('button', { name: PLAN_LIMIT_NOTICE.dismissCta })
    ).not.toBeInTheDocument()
  })

  it('dismisses when the customer chooses to', () => {
    const onDismiss = vi.fn()
    render(<PlanLimitNotice kind="check-limit" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: PLAN_LIMIT_NOTICE.dismissCta }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('never leaks internal limit vocabulary into the customer surface', () => {
    render(<PlanLimitNotice kind="site-limit" />)

    const text = document.body.textContent ?? ''
    for (const jargon of ['quota', 'credit', '402', 'UPGRADE_REQUIRED', 'plan gate']) {
      expect(text.toLowerCase()).not.toContain(jargon.toLowerCase())
    }
  })
})
