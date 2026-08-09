import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usePathname = vi.hoisted(() => vi.fn())
const useActiveAudit = vi.hoisted(() => vi.fn())
const dismiss = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ usePathname }))
vi.mock('@/hooks/useActiveAudit', () => ({ useActiveAudit }))

import { ActiveAuditBanner } from '@/components/audit/ActiveAuditBanner'

describe('ActiveAuditBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useActiveAudit.mockReturnValue({
      active: {
        auditId: 'audit-1',
      },
      dismiss,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'CHECKING', url: 'https://southernia.com' }),
    }))
  })

  it('never renders on the active report itself', () => {
    usePathname.mockReturnValue('/report/audit-1')

    render(<ActiveAuditBanner />)

    expect(screen.queryByText('Return to report')).not.toBeInTheDocument()
  })

  it('derives the hostname from the authorized status response', async () => {
    usePathname.mockReturnValue('/')

    render(<ActiveAuditBanner />)

    expect(await screen.findByText('southernia.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to report' })).toHaveAttribute(
      'href',
      '/report/audit-1'
    )
  })
})
