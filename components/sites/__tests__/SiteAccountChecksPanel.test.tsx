import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteAccountChecksPanel } from '../SiteSettingsPanels'
import { SiteRemovalDialog } from '../SiteRemovalDialog'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { ACCOUNT_CHECK_COPY as C } from '@/lib/marketing/copy/account-checks'
const account: AccountChecksView = { enabled: false, eligible: false, ready: false, reason: 'Routine checks paused',
  canCleanup: true, cleanupUnavailableReason: null,
  accounts: [{ purpose: 'retained', email: 'checks+1@example.com', state: 'ACTIVE' }], results: [] }
describe('owner test-account lifecycle controls', () => {
  it('keeps cleanup usable after routine capability and entitlement are unavailable', () => {
    const request = vi.fn()
    render(<SiteAccountChecksPanel initial={account} enabled={false} onToggle={vi.fn()} onRequest={request} />)
    expect(screen.getByRole('button', { name: C.retest })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: C.cleanup }))
    expect(request).toHaveBeenCalledWith('cleanup')
  })
  it('requires acknowledgement of the displayed accounts and resets it after a lifecycle change', () => {
    const remove = vi.fn()
    const props = { open: true, onOpenChange: vi.fn(), busy: false, onCleanup: vi.fn(), onRemove: remove, onCloseAutoFocus: vi.fn() }
    const { rerender } = render(<SiteRemovalDialog {...props} accounts={account} />)
    const button = screen.getByRole('button', { name: 'Remove Site' })
    expect(button).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: C.removalAcknowledgement }))
    expect(button).toBeEnabled()
    rerender(<SiteRemovalDialog {...props} accounts={{ ...account, accounts: [{ ...account.accounts[0], state: 'DELETING' }] }} />)
    expect(button).toBeDisabled()
    expect(remove).not.toHaveBeenCalled()
  })
})
