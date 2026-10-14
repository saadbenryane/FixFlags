'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GITHUB_CONNECTION_COPY as C } from '@/lib/marketing/copy/github-connection'
import { executeSiteAction, SiteActionError, siteActionMessage } from '@/lib/sites/client-actions'
import { githubSettingsDestination } from '@/lib/integrations/github-continuation'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function GithubConnectionControls({ connected, revoked, configured, destination }: {
  connected: boolean; revoked: boolean; configured: boolean; destination: string | null;
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState<SiteActionError | null>(null), [receipt, setReceipt] = useState<string | null>(null)
  async function disconnect() {
    setBusy(true); setError(null)
    try {
      const result = await executeSiteAction('/api/integrations/github/disconnect', { method: 'POST' }, 'githubDisconnect')
      setReceipt(result.revocation); setConfirm(false); router.refresh()
    } catch (err) { setError(err instanceof SiteActionError ? err : new SiteActionError(siteActionMessage(err))) }
    finally { setBusy(false) }
  }
  return <div className="space-y-4">
    {configured ? <Button asChild><a href={`/api/integrations/github/connect${destination ? `?next=${encodeURIComponent(destination)}` : ''}`}>{connected || revoked ? C.reconnect : C.connect}</a></Button> : <p role="status" className="text-sm text-muted-foreground">{C.errors.not_configured}</p>}
    {connected && receipt === null ? <div className="space-y-3">
      {confirm ? <><p>{C.removal}</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={() => void disconnect()}>{busy ? C.saving : C.confirm}</Button><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>{C.cancel}</Button></div></>
        : <Button variant="outline" onClick={() => setConfirm(true)}>{C.disconnect}</Button>}
    </div> : null}
    {receipt ? <p role="status">{receipt === 'confirmed' ? C.removed : receipt === 'not_needed' ? C.noConnection : C.locallyRemoved}{receipt === 'unconfirmed' ? <> <a className="underline" href="https://github.com/settings/applications" target="_blank" rel="noopener noreferrer">{C.revokeLink}</a></> : null}</p> : null}
    {error ? <p role="alert">{error.message}</p> : null}
    {error?.status === 401 ? <Button asChild variant="outline"><Link href={`/sign-in?next=${encodeURIComponent(githubSettingsDestination(destination))}`}>{SITE_ACTION_COPY.signInAction}</Link></Button> : null}
  </div>
}
