import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FeedbackDigestPanel } from '../FeedbackDigestPanel'
import { AdminActionButton } from '../AdminActionButton'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
describe('authorized exports and invites', () => {
  it('does not fetch or expose customer exports before explicit review', () => {
    render(<FeedbackDigestPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Window' }), { target: { value: '7' } })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Export records' })).toBeInTheDocument()
  })
  it('keeps an invite available as a link without requiring clipboard access', async () => {
    const joinUrl = 'https://fixflags.com/waitlist/pro?code=local'
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'Create invite',
            targetLabel: 'Member',
            effects: ['Create one invite'],
            intent: 'signed',
            expiresAt: new Date(Date.now() + 300000).toISOString(),
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'op', status: 'SUCCEEDED', result: { joinUrl } })),
      )
    render(<AdminActionButton action="WAITLIST_INVITE" targetId="entry" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create invite' }))
    fireEvent.change(screen.getByLabelText('Reason for this action'), {
      target: { value: 'Invite this member' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review action' }))
    await screen.findByText('Create one invite')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
    expect(await screen.findByRole('link', { name: 'Open invite' })).toHaveAttribute(
      'href',
      joinUrl,
    )
  })
  it('shows the actual server refusal before admission', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Target changed' }), { status: 409 }),
    )
    render(<AdminActionButton action="WAITLIST_GRANT" targetId="entry" />)
    fireEvent.click(screen.getByRole('button', { name: 'Grant waitlist access' }))
    fireEvent.change(screen.getByLabelText('Reason for this action'), {
      target: { value: 'Grant member access' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review action' }))
    await screen.findByText('Target changed')
    expect(screen.queryByRole('button', { name: 'Confirm action' })).not.toBeInTheDocument()
  })
})
