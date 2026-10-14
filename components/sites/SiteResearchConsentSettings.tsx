'use client'

import { useEffect, useId, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SiteSettingsSection } from './SiteSettingsSection'
import { RESEARCH_CONSENT_COPY as C } from '@/lib/marketing/copy/research'
import { RESEARCH_CONSENT_VERSION, researchConsentViewSchema, type ResearchConsentView } from '@/lib/growth/research-consent-contract'
import styles from './SiteSettingsPanels.module.css'

export function SiteResearchConsentSettings({ siteId }: { siteId: string }) {
  const id = useId()
  const [consent, setConsent] = useState<ResearchConsentView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setConsent(null)
    setError(null)
    setMessage(null)
    fetch(`/api/sites/${siteId}/research-consent`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable')
        const view = researchConsentViewSchema.parse(await response.json())
        if (!controller.signal.aborted) setConsent(view)
      }).catch(() => { if (!controller.signal.aborted) setError(C.unavailable) })
    return () => controller.abort()
  }, [siteId, reload])

  async function save(enabled: boolean) {
    if (busy || !consent) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/research-consent`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, policyVersion: RESEARCH_CONSENT_VERSION }),
      })
      if (!response.ok) throw new Error('Not saved')
      const view = researchConsentViewSchema.parse(await response.json())
      if (view.enabled !== enabled) throw new Error('Not saved')
      setConsent(view)
      setMessage(C.saved)
    } catch { setError(C.failed) } finally { setBusy(false) }
  }

  return <SiteSettingsSection id="research">
    <div className={styles.heading}><div><h2>{C.title}</h2><p>{C.body}</p></div></div>
    <p id={`${id}-scope`} className={styles.note}>{C.boundary}</p>
    <p id={`${id}-withdrawal`} className={styles.note}>{C.withdrawal}</p>
    {consent ? <label className={styles.toggle}>
      <Checkbox checked={consent.enabled} disabled={busy} aria-describedby={`${id}-scope ${id}-withdrawal`} onCheckedChange={(value) => void save(value === true)} />
      <span>{C.choice}</span>
    </label> : !error ? <p className={styles.note} role="status">{C.loading}</p> : null}
    {busy ? <p role="status" className={styles.note}>{C.saving}</p> : message ? <p role="status" className={styles.note}>{message}</p> : null}
    {error ? <div className={styles.note}><p role="alert">{error}</p><Button variant="ghost" onClick={() => setReload((value) => value + 1)}>{C.retry}</Button></div> : null}
  </SiteSettingsSection>
}
