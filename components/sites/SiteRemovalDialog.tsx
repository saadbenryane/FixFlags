'use client'

import { useEffect, useState } from 'react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ResponsiveDepth } from './ResponsiveDepth'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { ACCOUNT_CHECK_COPY as A } from '@/lib/marketing/copy/account-checks'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'

export function SiteRemovalDialog({ open, onOpenChange, accounts, busy, onCleanup, onRemove, onCloseAutoFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; accounts?: AccountChecksView; busy: boolean;
  onCleanup: () => void; onRemove: (remaining: AccountChecksView['accounts']) => void; onCloseAutoFocus: (event: Event) => void;
}) {
  const remaining = accounts?.accounts.filter(account => account.state !== 'DELETED') ?? []
  const snapshot = JSON.stringify(remaining)
  const [acknowledged, setAcknowledged] = useState(false)
  useEffect(() => { setAcknowledged(false) }, [open, snapshot])
  return <ResponsiveDepth open={open} onOpenChange={onOpenChange} onCloseAutoFocus={onCloseAutoFocus}>
    <DialogTitle>{S.remove}</DialogTitle>
    <DialogDescription>{S.removeBody}</DialogDescription>
    {remaining.length > 0 ? <div className="mt-4 space-y-3">
      <p className="text-sm">{A.removalAccounts}</p>
      <ul className="space-y-2 text-sm">{remaining.map(account => <li key={account.email} className="break-all">
        <strong>{account.email}</strong><span className="ml-2 text-muted-foreground">{A.accountStates[account.state]}</span>
      </li>)}</ul>
      <Button variant="outline" disabled={busy || !accounts?.canCleanup} onClick={onCleanup}>{A.cleanup}</Button>
      {accounts?.cleanupUnavailableReason ? <p className="text-sm text-muted-foreground">{accounts.cleanupUnavailableReason}</p> : null}
      <label className="flex min-h-11 items-start gap-3 py-2 text-sm"><input type="checkbox" className="mt-1" checked={acknowledged}
        disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>{A.removalAcknowledgement}</span></label>
    </div> : null}
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{C.cancel}</Button>
      <Button variant="destructive" disabled={busy || remaining.length > 0 && !acknowledged} onClick={() => onRemove(remaining)}>{S.remove}</Button>
    </div>
  </ResponsiveDepth>
}
