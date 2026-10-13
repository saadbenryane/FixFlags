import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { UserTable } from '../UserTable'
import { LeadEditor } from '../LeadEditor'
import { RetryAuditButton } from '../RetryAuditButton'
import { AdminPagination } from '../AdminListControls'
const state = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))
const preview = {
  title: 'Review action',
  targetLabel: 'Local target',
  effects: ['Recorded effect'],
  intent: 'signed',
  expiresAt: new Date(Date.now() + 300000).toISOString(),
  recentAuthenticationRequired: false,
  destructive: false,
}
async function review(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.change(screen.getByLabelText('Reason for this action'), {
    target: { value: 'A meaningful operator reason' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review action' }))
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})
describe('confirmed operator workflows', () => {
  it('opens customer detail instead of mutating a commercial plan from the list', () => {
    render(
      <UserTable
        users={[
          {
            id: 'u1',
            email: 'alice@example.com',
            name: 'Alice',
            role: 'user',
            plan: 'FREE',
            auditsUsed: 1,
            auditsLimit: 3,
            createdAt: '2026-10-01',
            totalCostLabel: 'Not recorded',
          },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Manage customer' })).toHaveAttribute(
      'href',
      '/admin/users/u1',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps lead notes after a failed preview', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Connection unavailable'))
    render(<LeadEditor domain="example.com" initialStatus="NEW" initialNotes="Original" />)
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Follow up tomorrow' } })
    await review('Save lead changes')
    await screen.findByText('Connection unavailable')
    expect(screen.getByLabelText('Notes')).toHaveValue('Follow up tomorrow')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('requires preview before retry admission and links the admitted check', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(preview)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'op',
            status: 'SUCCEEDED',
            result: { auditId: 'new-check', state: 'ADMITTED' },
          }),
        ),
      )
    render(<RetryAuditButton auditId="failed-check" />)
    await review('Retry this check')
    await screen.findByText('Recorded effect')
    expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
    expect(await screen.findByRole('link', { name: 'Open check' })).toHaveAttribute(
      'href',
      '/admin/audits/new-check',
    )
  })
  it('reuses the same confirmation key after a transport failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(preview)))
      .mockRejectedValueOnce(new Error('Connection unavailable'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'op', status: 'SUCCEEDED', result: {} })),
      )
    render(<RetryAuditButton auditId="failed-check" />)
    await review('Retry this check')
    await screen.findByText('Recorded effect')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
    await screen.findByText('Connection unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
    await screen.findByText('Completed')
    const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/admin/actions')
    expect(JSON.parse(calls[0][1]!.body as string).idempotencyKey).toBe(
      JSON.parse(calls[1][1]!.body as string).idempotencyKey,
    )
  })
  it('keeps an uncertain outcome visible without presenting success', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(preview)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'op',
            status: 'INDETERMINATE',
            result: null,
            errorMessage: 'Provider acceptance unknown',
          }),
        ),
      )
    render(<RetryAuditButton auditId="failed-check" />)
    await review('Retry this check')
    await screen.findByText('Recorded effect')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
    await screen.findByText('Outcome not confirmed')
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
  })
  it('preserves query filters across pagination', () => {
    render(
      <AdminPagination
        path="/admin/audits"
        page={2}
        pages={3}
        total={125}
        filters={{ q: 'example.com', status: 'FAILED' }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/admin/audits?q=example.com&status=FAILED&page=3',
    )
  })
})
