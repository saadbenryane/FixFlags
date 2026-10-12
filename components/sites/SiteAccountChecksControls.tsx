'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SiteAccountChecksPanel } from './SiteSettingsPanels'
import { SiteActionFeedback } from './SiteActionFeedback'
import { useSiteAction } from '@/hooks/useSiteAction'
import { createSiteActionController, executeSiteAction } from '@/lib/sites/client-actions'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { ACCOUNT_CHECK_COPY as C } from '@/lib/marketing/copy/account-checks'

export function SiteAccountChecksControls({ siteId, initial }: { siteId: string; initial?: AccountChecksView }) {
  const router = useRouter(), { busy, message, error, submit } = useSiteAction()
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const initialEnabled = initial?.enabled
  useEffect(() => { if (initialEnabled !== undefined) setEnabled(initialEnabled) }, [initialEnabled])
  const action = useRef(createSiteActionController(`site:${siteId}:accounts`)).current
  async function toggle(value: boolean) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountChecksEnabled: value }) }, 'settings'), () => { setEnabled(value); router.refresh(); return C.saved })
  }
  async function request(mode: 'retest' | 'cleanup') {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/account-checks`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': action.requestKey(mode) }, body: JSON.stringify({ action: mode }) }, 'run'),
      () => { action.completeIntent(mode); router.refresh(); return C.requested })
  }
  return <SiteAccountChecksPanel initial={initial} enabled={enabled} busy={busy} onToggle={value => void toggle(value)} onRequest={mode => void request(mode)}
    feedback={<>{busy ? <p role="status" className="mt-3 text-sm">{C.saving}</p> : null}<SiteActionFeedback message={message} error={error} siteId={siteId} /></>} />
}
