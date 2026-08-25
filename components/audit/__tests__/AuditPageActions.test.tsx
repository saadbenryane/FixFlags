import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/audit/ShareDrawer', () => ({ ShareDrawer: () => <div>Share control</div> }))
vi.mock('@/components/audit/ExportMenu', () => ({ ExportMenu: () => <div>Export control</div> }))
vi.mock('@/components/audit/CopyMcpCommand', () => ({ CopyMcpCommand: () => <div>MCP control</div> }))

import { AuditPageActions } from '@/components/audit/AuditPageActions'

const baseProps = {
  auditId: 'review-1',
  url: 'https://example.com',
  score: 72,
  rubrics: [],
  isPaid: false,
  isPublic: false,
}

describe('AuditPageActions access projection', () => {
  it('does not offer an update review to an anonymous viewer', () => {
    render(
      <AuditPageActions
        {...baseProps}
        isLoggedIn={false}
        isOwner={false}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Update review' })).not.toBeInTheDocument()
    expect(screen.queryByText('Share control')).not.toBeInTheDocument()
    expect(screen.queryByText('Export control')).not.toBeInTheDocument()
  })

  it('offers the single update-review action to the signed-in owner', () => {
    render(
      <AuditPageActions
        {...baseProps}
        isLoggedIn
        isOwner
      />,
    )

    expect(screen.getByRole('button', { name: 'Update review' })).toBeInTheDocument()
  })
})
