import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const routerReplace = vi.hoisted(() => vi.fn())
const startScanWithHandoff = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: routerReplace }),
}))
vi.mock('@/components/audit/ExportMenu', () => ({ ExportMenu: () => <div>Export control</div> }))
vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff,
}))
vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

import { AuditPageActions } from '@/components/audit/AuditPageActions'

const baseProps = {
  auditId: 'review-1',
  url: 'https://example.com',
  score: 72,
  rubrics: [],
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

  it('offers Recheck to a claimed anonymous session without Export', () => {
    render(
      <AuditPageActions
        {...baseProps}
        isLoggedIn={false}
        isOwner={false}
        isClaimedAnonymous
      />,
    )

    expect(screen.getByRole('button', { name: 'Update review' })).toBeInTheDocument()
    expect(screen.queryByText('Export control')).not.toBeInTheDocument()
  })

  it('navigates to the in-flight work report after Update review', async () => {
    startScanWithHandoff.mockImplementation(async (options: {
      navigate: (href: string) => void
    }) => {
      options.navigate('/report/child-1')
      return { ok: true, reportId: 'child-1' }
    })

    render(
      <AuditPageActions
        {...baseProps}
        isLoggedIn
        isOwner
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update review' }))

    await waitFor(() => {
      expect(startScanWithHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/reports/review-1/re-check',
          navigate: expect.any(Function),
        }),
      )
      expect(routerReplace).toHaveBeenCalledWith('/report/child-1')
    })
  })

  it('offers icon-only Compare next to Update review for owners with a compare target', () => {
    render(
      <AuditPageActions
        {...baseProps}
        isLoggedIn
        isOwner
        compareAuditId="child-1"
      />,
    )

    expect(screen.getByRole('button', { name: 'Update review' })).toBeInTheDocument()
    const compare = screen.getByRole('link', { name: 'Compare' })
    expect(compare).toBeInTheDocument()
    expect(compare).toHaveAttribute('href', '/compare/child-1')
    expect(compare.textContent?.trim()).toBe('')
  })
})
