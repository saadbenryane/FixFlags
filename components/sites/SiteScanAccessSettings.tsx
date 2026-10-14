'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SITE_SETTINGS_COPY } from '@/lib/marketing/copy/site-settings'
import { executeSiteAction, SiteActionError, type siteActionSchemas } from '@/lib/sites/client-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import type { z } from 'zod'
import { SiteActionFeedback } from './SiteActionFeedback'
import { SiteSettingsSection } from './SiteSettingsSection'
import styles from './SiteSettingsPanels.module.css'

type Access = z.infer<typeof siteActionSchemas.scanAccess>
export function SiteScanAccessSettings({ siteId }: { siteId: string }) {
  const C = SITE_SETTINGS_COPY.access
  const id = useId(), router = useRouter()
  const [saved, setSaved] = useState<Access | null>(null)
  const [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false)
  const [unreadable, setUnreadable] = useState(false)
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [note, setNote] = useState('')
  const [headers, setHeaders] = useState(''), [cookies, setCookies] = useState('')
  const { busy, message, error, submit } = useSiteAction(`site:${siteId}:access`)
  const endpoint = `/api/sites/${siteId}/scan-access`
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadFailed(false); setUnreadable(false)
    try {
      const value = await executeSiteAction(endpoint, { method: 'GET', cache: 'no-store', signal }, 'scanAccess')
      if (!signal?.aborted) setSaved(value)
    } catch (error) { if (!signal?.aborted) { setLoadFailed(true); setUnreadable(error instanceof SiteActionError && error.code === 'ACCESS_UNREADABLE') } }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [endpoint])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])
  async function save() {
    await submit(async () => {
      let customHeaders: unknown, customCookies: unknown
      try {
        customHeaders = headers.trim() ? JSON.parse(headers) : undefined
        customCookies = cookies.trim() ? JSON.parse(cookies) : undefined
        if (customHeaders !== undefined && (!customHeaders || typeof customHeaders !== 'object' || Array.isArray(customHeaders)) ||
          customCookies !== undefined && !Array.isArray(customCookies)) throw new Error()
      } catch { throw new SiteActionError(C.invalid) }
      return executeSiteAction(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        scanAccess: { ...(username ? { httpBasic: { username, password } } : {}), headers: customHeaders, cookies: customCookies, label: note || undefined },
      }) }, 'scanAccess')
    }, value => { setSaved(value); setLoadFailed(false); setUnreadable(false); setUsername(''); setPassword(''); setHeaders(''); setCookies(''); setNote(''); return C.saved }, () => router.refresh())
  }
  async function remove() {
    await submit(() => executeSiteAction(endpoint, { method: 'DELETE' }, 'scanAccess'), value => { setSaved(value); setLoadFailed(false); setUnreadable(false); return C.removed }, () => router.refresh())
  }
  return <SiteSettingsSection id="scan-access" tabIndex={-1}>
    <div className={styles.heading}><span className={styles.icon}><KeyRound size={17} aria-hidden /></span><div><h2>{C.title}</h2><p>{C.body}</p></div></div>
    {loading ? <p role="status" className={styles.note}>{SITE_SETTINGS_COPY.access.loading}</p> : loadFailed ? <div className={styles.actions}><p role="alert">{unreadable ? C.unreadable : C.unavailable}</p><Button variant="outline" onClick={() => void load()}>{C.retry}</Button></div>
      : <p className={styles.note}>{saved?.configured ? C.configured : C.public}{saved?.summary?.label ? ` ${saved.summary.label}` : ''}</p>}
    <form onSubmit={event => { event.preventDefault(); void save() }} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm" htmlFor={`${id}-username`}><span>{C.username}</span><Input id={`${id}-username`} value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" maxLength={200} disabled={busy} /></label>
        <label className="space-y-2 text-sm" htmlFor={`${id}-password`}><span>{C.password}</span><Input id={`${id}-password`} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" maxLength={500} disabled={busy} /></label>
      </div>
      <details className="text-sm"><summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{C.advanced}</summary>
        <div className="mt-3 space-y-4">{[{ key: 'headers', label: C.headers, value: headers, change: setHeaders }, { key: 'cookies', label: C.cookies, value: cookies, change: setCookies }].map(field => <label key={field.key} className="block space-y-2" htmlFor={`${id}-${field.key}`}><span>{field.label}</span><textarea id={`${id}-${field.key}`} value={field.value} onChange={event => field.change(event.target.value)} maxLength={100_000} rows={4} disabled={busy} spellCheck={false} className="min-h-11 w-full rounded-control border border-border bg-background p-3 font-mono text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></label>)}</div>
      </details>
      <label className="block space-y-2 text-sm" htmlFor={`${id}-note`}><span>{C.note}</span><Input id={`${id}-note`} value={note} onChange={event => setNote(event.target.value)} maxLength={200} disabled={busy} /></label>
      <p className="text-sm text-muted-foreground">{C.replacement}</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || loading || loadFailed && !unreadable || !username && !headers.trim() && !cookies.trim()}>{C.save}</Button>
        {saved?.configured || unreadable ? <Button variant="outline" type="button" disabled={busy || loading || loadFailed && !unreadable} onClick={() => void remove()}>{C.remove}</Button> : null}</div>
    </form>
    <SiteActionFeedback siteId={siteId} message={message} error={error} />
  </SiteSettingsSection>
}
