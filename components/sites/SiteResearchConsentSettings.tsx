'use client'

import { useEffect, useId, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SiteSettingsSection } from './SiteSettingsSection'
import { RESEARCH_CONSENT_COPY as C } from '@/lib/marketing/copy/research'
import { RESEARCH_CONSENT_VERSION, researchConsentViewSchema, type ResearchConsentView } from '@/lib/growth/research-consent-contract'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SiteActionError } from '@/lib/sites/client-actions'
import styles from './SiteSettingsPanels.module.css'

export function SiteResearchConsentSettings({ siteId }: { siteId: string }) {
  return <ResearchConsentContent key={siteId} siteId={siteId} />
}

function ResearchConsentContent({ siteId }: { siteId: string }) {
  const id = useId()
  const [consent, setConsent] = useState<ResearchConsentView | null>(null)
  const { busy, error: saveError, message, submit, clearFeedback } = useSiteAction({ scope: siteId })
  const [readError, setReadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const error = readError ?? saveError?.message
  useEffect(() => {
    const controller = new AbortController()
    setConsent(null)
    setReadError(null)
    fetchJsonWithDeadline(`/api/sites/${encodeURIComponent(siteId)}/research-consent`, { cache: 'no-store', signal: controller.signal }, 15_000)
      .then(({ response, body }) => {
        if (!response.ok) throw new Error('Unavailable')
        const view = researchConsentViewSchema.parse(body)
        if (!controller.signal.aborted) setConsent(view)
      }).catch(() => { if (!controller.signal.aborted) setReadError(C.unavailable) })
    return () => controller.abort()
  }, [siteId, reload])

  async function save(enabled: boolean) {
    if (!consent) return
    await submit(async signal => {
      try {
        const { response, body } = await fetchJsonWithDeadline(`/api/sites/${encodeURIComponent(siteId)}/research-consent`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, signal,
          body: JSON.stringify({ enabled, policyVersion: RESEARCH_CONSENT_VERSION }),
        })
        if (!response.ok) throw new Error('Not saved')
        const view = researchConsentViewSchema.parse(body)
        if (view.enabled !== enabled || signal.aborted) throw new Error('Not saved')
        return view
      } catch { throw new SiteActionError(C.failed) }
    }, view => {
      setConsent(view)
      return C.saved
    })
  }

  return <SiteSettingsSection id="research">
    <div className={styles.heading}><div><h2>{C.title}</h2><p>{C.body}</p></div></div>
    <p id={`${id}-scope`} className={styles.note}>{C.boundary}</p>
    <p id={`${id}-withdrawal`} className={styles.note}>{C.withdrawal}</p>
    {consent ? <label className={styles.toggle}>
      <Checkbox checked={consent.enabled} disabled={busy} aria-busy={busy || undefined} aria-describedby={`${id}-scope ${id}-withdrawal`} onCheckedChange={(value) => void save(value === true)} />
      <span>{C.choice}</span>
    </label> : !error ? <p className={styles.note} role="status">{C.loading}</p> : null}
    {busy ? <p role="status" className={styles.note}>{C.saving}</p> : !error && message ? <p role="status" className={styles.note}>{message}</p> : null}
    {error ? <div className={styles.note}><p role="alert">{error}</p><Button variant="ghost" disabled={busy} onClick={() => { clearFeedback(); setReload((value) => value + 1) }}>{C.retry}</Button></div> : null}
  </SiteSettingsSection>
}
