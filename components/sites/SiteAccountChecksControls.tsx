'use client'
import { SiteAccountChecksPanel } from './SiteSettingsPanels'
import { SiteActionFeedback } from './SiteActionFeedback'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction } from '@/lib/sites/client-actions'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { ACCOUNT_CHECK_COPY as C } from '@/lib/marketing/copy/account-checks'

export function SiteAccountChecksControls({ siteId, initial, onRefresh }: {
  siteId: string; initial?: AccountChecksView; onRefresh: () => Promise<unknown>
}) {
  const { busy, message, error, submit, requestKey, completeIntent } = useSiteAction(`site:${siteId}:accounts`)
  const enabled = initial?.enabled ?? true
  async function toggle(value: boolean) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountChecksEnabled: value }) }, 'settings'), () => C.saved, onRefresh)
  }
  async function request(mode: 'retest' | 'cleanup') {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/account-checks`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey(mode) }, body: JSON.stringify({ action: mode }) }, 'run'),
      () => { completeIntent(mode); return C.requested }, onRefresh)
  }
  return <SiteAccountChecksPanel initial={initial} enabled={enabled} busy={busy} onToggle={value => void toggle(value)} onRequest={mode => void request(mode)}
    feedback={<>{busy ? <p role="status" className="mt-3 text-sm">{C.saving}</p> : null}<SiteActionFeedback message={message} error={error} siteId={siteId} /></>} />
}
