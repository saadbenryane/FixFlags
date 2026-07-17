import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FirstAuditPrompt } from '@/components/dashboard/FirstAuditPrompt'
import { FIRST_AUDIT_PROMPT } from '@/lib/marketing/copy'

describe('FirstAuditPrompt', () => {
  it('renders the no-scans empty state from centralized copy', () => {
    render(<FirstAuditPrompt />)
    expect(screen.getByText(FIRST_AUDIT_PROMPT.headline)).toBeInTheDocument()
    expect(screen.getByText(FIRST_AUDIT_PROMPT.body)).toBeInTheDocument()
    for (const example of FIRST_AUDIT_PROMPT.examples) {
      expect(screen.getByText(example.label)).toBeInTheDocument()
    }
  })

  it('always offers the sample report as a next step', () => {
    render(<FirstAuditPrompt />)
    expect(
      screen.getByRole('link', { name: FIRST_AUDIT_PROMPT.footerLink })
    ).toHaveAttribute('href', '/samples')
  })
})
